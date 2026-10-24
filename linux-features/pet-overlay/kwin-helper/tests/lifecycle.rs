use std::{
    io::BufRead,
    process::{Child, Command, Stdio},
    sync::{Arc, Mutex},
    time::Duration,
};
use zbus::Connection;

struct Process(Child);
impl Drop for Process {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

struct Scripting(Arc<Mutex<Vec<String>>>);
#[zbus::interface(name = "org.kde.kwin.Scripting")]
impl Scripting {
    #[zbus(name = "unloadScript")]
    fn unload_script(&self, name: &str) -> bool {
        self.0.lock().unwrap().push(name.into());
        true
    }
    #[zbus(name = "isScriptLoaded")]
    fn is_script_loaded(&self, _name: &str) -> bool {
        false
    }
}

async fn scripting(address: &str) -> (Connection, Arc<Mutex<Vec<String>>>) {
    let connection = zbus::connection::Builder::address(address)
        .unwrap()
        .build()
        .await
        .unwrap();
    let unloaded = Arc::new(Mutex::new(Vec::new()));
    connection
        .object_server()
        .at("/Scripting", Scripting(unloaded.clone()))
        .await
        .unwrap();
    (connection, unloaded)
}

async fn check_exit(reason: &str) {
    let mut bus = Process(
        Command::new("dbus-daemon")
            .args(["--session", "--nofork", "--print-address=1"])
            .stdout(Stdio::piped())
            .spawn()
            .unwrap(),
    );
    let mut address = String::new();
    std::io::BufReader::new(bus.0.stdout.take().unwrap())
        .read_line(&mut address)
        .unwrap();
    let address = address.trim();
    let (owner, unloaded) = scripting(address).await;
    owner.request_name("org.kde.KWin").await.unwrap();
    let name = "codex_pet_bridge_lifecycle";
    let mut helper = Process(
        Command::new(env!("CARGO_BIN_EXE_codex-pet-kwin"))
            .args([name, &"a".repeat(64)])
            .env("DBUS_SESSION_BUS_ADDRESS", address)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .unwrap(),
    );
    let mut output = std::io::BufReader::new(helper.0.stdout.take().unwrap());
    let mut line = String::new();
    output.read_line(&mut line).unwrap();
    assert_eq!(
        serde_json::from_str::<serde_json::Value>(&line).unwrap()["type"],
        "listening"
    );
    let mut replacement = None;
    if reason == "EOF" {
        drop(helper.0.stdin.take());
    } else if reason == "owner" {
        owner.release_name("org.kde.KWin").await.unwrap();
        let (connection, foreign) = scripting(address).await;
        connection.request_name("org.kde.KWin").await.unwrap();
        replacement = Some((connection, foreign));
    } else {
        assert!(Command::new("kill")
            .args([format!("-{reason}"), helper.0.id().to_string()])
            .status()
            .unwrap()
            .success());
    }
    let status = tokio::time::timeout(Duration::from_secs(5), async {
        loop {
            if let Some(status) = helper.0.try_wait().unwrap() {
                break status;
            }
            tokio::time::sleep(Duration::from_millis(10)).await;
        }
    })
    .await
    .expect("helper must exit even while its parent keeps stdin open");
    assert_eq!(status.code(), Some(if reason == "owner" { 1 } else { 0 }));
    assert_eq!(*unloaded.lock().unwrap(), [name]);
    if let Some((_, foreign)) = replacement {
        assert!(foreign.lock().unwrap().is_empty());
    }
}

#[tokio::test(flavor = "current_thread")]
async fn eof_unloads_owned_script() {
    check_exit("EOF").await;
}
#[tokio::test(flavor = "current_thread")]
async fn sigterm_unloads_owned_script_with_stdin_open() {
    check_exit("TERM").await;
}
#[tokio::test(flavor = "current_thread")]
async fn sigint_unloads_owned_script_with_stdin_open() {
    check_exit("INT").await;
}
#[tokio::test(flavor = "current_thread")]
async fn sighup_unloads_owned_script_with_stdin_open() {
    check_exit("HUP").await;
}
#[tokio::test(flavor = "current_thread")]
async fn owner_change_unloads_original_connection_only() {
    check_exit("owner").await;
}
