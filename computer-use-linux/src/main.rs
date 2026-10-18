#[cfg(target_os = "linux")]
use mimalloc::MiMalloc;
#[cfg(target_os = "linux")]
#[global_allocator]
static GLOBAL: MiMalloc = MiMalloc;
#[tokio::main(flavor = "current_thread")]
async fn main() -> anyhow::Result<()> {
    codex_computer_use_linux::run_cli_from_env().await
}
