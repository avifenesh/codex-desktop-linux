use anyhow::{bail, Context, Result};
use futures_util::StreamExt;
use serde_json::{json, Value};
use std::{io::Write, sync::Arc, time::Duration};
use tokio::{
    io::{AsyncBufRead, AsyncBufReadExt, AsyncReadExt, BufReader},
    signal::unix::{signal, SignalKind},
    sync::{mpsc, Mutex},
};
use zbus::{message::Header, Connection, Proxy};

const PATH: &str = "/org/chatgpt/Community/Pet";
const MAX_LINE: usize = 65536;
const MAX_SAFE: u64 = 9_007_199_254_740_991;

fn emit(value: &Value) -> Result<()> {
    let mut out = std::io::stdout().lock();
    serde_json::to_writer(&mut out, value)?;
    out.write_all(b"\n")?;
    out.flush()?;
    Ok(())
}

fn validate_command(value: &Value) -> Result<()> {
    let op = value["op"].as_str().context("missing operation")?;
    if ![
        "prepare",
        "hints",
        "drag",
        "endDrag",
        "pointer",
        "keyboard",
        "proximity",
        "stop",
    ]
    .contains(&op)
    {
        bail!("unsupported operation");
    }
    for field in ["seq", "epoch", "deadline"] {
        if !value[field]
            .as_u64()
            .is_some_and(|v| v > 0 && v <= MAX_SAFE)
        {
            bail!("invalid {field}");
        }
    }
    if !value["data"].is_object() {
        bail!("invalid command data");
    }
    Ok(())
}

struct Bridge {
    owner: String,
    token: String,
    commands: Arc<Mutex<mpsc::Receiver<String>>>,
}

#[zbus::interface(name = "org.chatgpt.Community.Pet1")]
impl Bridge {
    async fn next_command(
        &self,
        token: &str,
        acknowledgement: &str,
        #[zbus(header)] header: Header<'_>,
    ) -> zbus::fdo::Result<String> {
        if token != self.token || header.sender().map(|n| n.as_str()) != Some(self.owner.as_str()) {
            return Err(zbus::fdo::Error::AccessDenied("foreign session".into()));
        }
        let mut commands = self
            .commands
            .try_lock()
            .map_err(|_| zbus::fdo::Error::Failed("request already pending".into()))?;
        if acknowledgement.len() > 8192 {
            return Err(zbus::fdo::Error::InvalidArgs(
                "oversized acknowledgement".into(),
            ));
        }
        let ack: Value = serde_json::from_str(acknowledgement)
            .map_err(|_| zbus::fdo::Error::InvalidArgs("invalid acknowledgement".into()))?;
        if !matches!(ack["type"].as_str(), Some("ready" | "ack" | "event")) {
            return Err(zbus::fdo::Error::InvalidArgs(
                "invalid acknowledgement type".into(),
            ));
        }
        if ack["type"] != "ack" || ack["seq"] != 0 {
            emit(&ack).map_err(|e| zbus::fdo::Error::Failed(e.to_string()))?;
        }
        // Keep the request below Qt's D-Bus timeout and renew the script's liveness lease.
        Ok(
            match tokio::time::timeout(Duration::from_millis(500), commands.recv()).await {
                Ok(Some(command)) => command,
                _ => "{}".into(),
            },
        )
    }

    fn event(
        &self,
        token: &str,
        event: &str,
        #[zbus(header)] header: Header<'_>,
    ) -> zbus::fdo::Result<()> {
        if token != self.token || header.sender().map(|n| n.as_str()) != Some(self.owner.as_str()) {
            return Err(zbus::fdo::Error::AccessDenied("foreign session".into()));
        }
        if event.len() > 8192 {
            return Err(zbus::fdo::Error::InvalidArgs("oversized event".into()));
        }
        let event: Value = serde_json::from_str(event)
            .map_err(|_| zbus::fdo::Error::InvalidArgs("invalid event".into()))?;
        if event["type"] != "event" {
            return Err(zbus::fdo::Error::InvalidArgs("invalid event type".into()));
        }
        emit(&event).map_err(|e| zbus::fdo::Error::Failed(e.to_string()))
    }
}

async fn read_command(reader: &mut (impl AsyncBufRead + Unpin)) -> Result<Option<Value>> {
    let mut bytes = Vec::new();
    let length = (&mut *reader)
        .take((MAX_LINE + 1) as u64)
        .read_until(b'\n', &mut bytes)
        .await?;
    if length == 0 {
        return Ok(None);
    }
    if length > MAX_LINE || bytes.last() != Some(&b'\n') {
        bail!("oversized or incomplete command");
    }
    let value = serde_json::from_slice(&bytes)?;
    validate_command(&value)?;
    Ok(Some(value))
}

async fn unload(connection: &Connection, owner: &str, name: &str) -> Result<()> {
    let proxy = Proxy::new(connection, owner, "/Scripting", "org.kde.kwin.Scripting").await?;
    let _: bool = proxy.call("unloadScript", &(name,)).await?;
    for _ in 0..20 {
        let loaded: bool = proxy.call("isScriptLoaded", &(name,)).await?;
        if !loaded {
            return Ok(());
        }
        tokio::time::sleep(Duration::from_millis(25)).await;
    }
    bail!("KWin did not remove the Mini script");
}

async fn run() -> Result<()> {
    // Install before connecting so termination at any startup phase remains pending.
    let mut terminate = signal(SignalKind::terminate())?;
    let mut interrupt = signal(SignalKind::interrupt())?;
    let mut hangup = signal(SignalKind::hangup())?;
    let args: Vec<_> = std::env::args().skip(1).collect();
    if args.len() != 2
        || !args[0].starts_with("codex_pet_bridge_")
        || args[0].len() > 128
        || !args[0]
            .bytes()
            .all(|c| c.is_ascii_alphanumeric() || c == b'_')
        || args[1].len() != 64
        || !args[1].bytes().all(|c| c.is_ascii_hexdigit())
    {
        bail!("usage: codex-pet-kwin <unique-script-name> <64-hex-session>");
    }
    let connection = Connection::session().await?;
    let bus = zbus::fdo::DBusProxy::new(&connection).await?;
    let mut owners = bus
        .receive_name_owner_changed_with_args(&[(0, "org.kde.KWin")])
        .await?;
    let owner = bus
        .get_name_owner("org.kde.KWin".try_into()?)
        .await?
        .to_string();
    let (send, receive) = mpsc::channel(8);
    connection
        .object_server()
        .at(
            PATH,
            Bridge {
                owner: owner.clone(),
                token: args[1].clone(),
                commands: Arc::new(Mutex::new(receive)),
            },
        )
        .await?;
    emit(
        &json!({"type":"listening", "address":connection.unique_name().context("missing bus name")?.as_str(), "owner":owner}),
    )?;
    let input = async {
        let mut reader = BufReader::new(tokio::io::stdin());
        while let Some(command) = read_command(&mut reader).await? {
            send.try_send(serde_json::to_string(&command)?)
                .context("Mini command queue is full")?;
        }
        Ok(())
    };
    let result = tokio::select! {
        result = input => result,
        _ = terminate.recv() => Ok(()),
        _ = interrupt.recv() => Ok(()),
        _ = hangup.recv() => Ok(()),
        _ = owners.next() => Err(anyhow::anyhow!("KWin connection changed")),
    };
    drop(send);
    let cleanup = tokio::time::timeout(
        Duration::from_secs(2),
        unload(&connection, &owner, &args[0]),
    )
    .await;
    if !matches!(cleanup, Ok(Ok(()))) {
        eprintln!("Mini script cleanup incomplete; its liveness lease will expire");
    }
    result
}

#[tokio::main(flavor = "current_thread")]
async fn main() {
    let code = match run().await {
        Ok(()) => 0,
        Err(error) => {
            eprintln!("{error:#}");
            1
        }
    };
    // Tokio's blocking stdin read can outlive cancellation; cleanup has completed.
    std::process::exit(code);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::BufRead;
    struct TestBus(std::process::Child);
    impl Drop for TestBus {
        fn drop(&mut self) {
            let _ = self.0.kill();
            let _ = self.0.wait();
        }
    }
    async fn connections() -> (TestBus, Connection, Connection, Connection) {
        let mut daemon = std::process::Command::new("dbus-daemon")
            .args(["--session", "--nofork", "--print-address=1"])
            .stdout(std::process::Stdio::piped())
            .spawn()
            .unwrap();
        let mut address = String::new();
        std::io::BufReader::new(daemon.stdout.take().unwrap())
            .read_line(&mut address)
            .unwrap();
        let connect = || {
            zbus::connection::Builder::address(address.trim())
                .unwrap()
                .build()
        };
        let server = connect().await.unwrap();
        let owner = connect().await.unwrap();
        let foreign = connect().await.unwrap();
        (TestBus(daemon), server, owner, foreign)
    }

    #[tokio::test(flavor = "current_thread")]
    async fn private_bus_authentication_and_delayed_command_reply() {
        let (_bus, server, owner, foreign) = connections().await;
        let (send, receive) = mpsc::channel(1);
        server
            .object_server()
            .at(
                PATH,
                Bridge {
                    owner: owner.unique_name().unwrap().to_string(),
                    token: "secret".into(),
                    commands: Arc::new(Mutex::new(receive)),
                },
            )
            .await
            .unwrap();
        let proxy = |connection| {
            Proxy::new(
                connection,
                server.unique_name().unwrap().as_str(),
                PATH,
                "org.chatgpt.Community.Pet1",
            )
        };
        let own_proxy = proxy(&owner).await.unwrap();
        let foreign_proxy = proxy(&foreign).await.unwrap();
        let ack = r#"{"type":"ready"}"#;
        let result: zbus::Result<String> =
            foreign_proxy.call("NextCommand", &("secret", ack)).await;
        assert!(result.is_err());
        let result: zbus::Result<String> = own_proxy.call("NextCommand", &("wrong", ack)).await;
        assert!(result.is_err());
        let payload = json!({"seq":1,"epoch":1,"deadline":123,"op":"stop","data":{}}).to_string();
        let expected = payload.clone();
        let deliver = tokio::spawn(async move {
            tokio::time::sleep(Duration::from_millis(25)).await;
            send.send(payload).await.unwrap();
        });
        let reply: String = own_proxy
            .call("NextCommand", &("secret", ack))
            .await
            .unwrap();
        assert_eq!(reply, expected);
        deliver.await.unwrap();
        let oversized = "x".repeat(8193);
        let result: zbus::Result<()> = own_proxy.call("Event", &("secret", oversized)).await;
        assert!(result.is_err());
    }
    #[test]
    fn validates_fixed_operations_and_safe_sequences() {
        let good = json!({"seq":1,"epoch":1,"deadline":123,"op":"stop","data":{}});
        assert!(validate_command(&good).is_ok());
        for (key, value) in [
            ("op", json!("eval")),
            ("seq", json!(0)),
            ("epoch", json!(-1)),
            ("deadline", json!(MAX_SAFE + 1)),
            ("data", json!([])),
        ] {
            let mut bad = good.clone();
            bad[key] = value;
            assert!(validate_command(&bad).is_err(), "{key}");
        }
    }
    #[tokio::test]
    async fn rejects_unbounded_and_truncated_stdin() {
        assert!(read_command(&mut &b"{}"[..]).await.is_err());
        assert!(read_command(&mut vec![b'x'; MAX_LINE + 1].as_slice())
            .await
            .is_err());
        assert!(read_command(&mut &b""[..]).await.unwrap().is_none());
    }
}
