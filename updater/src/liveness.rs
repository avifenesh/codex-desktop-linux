//! Process liveness checks for the Electron app managed by the updater.

use crate::config::RuntimeConfig;
use anyhow::{Context, Result};
use std::{
    fs,
    os::unix::ffi::OsStrExt,
    path::{Path, PathBuf},
};

/// Detects whether the managed Electron app is currently running.
pub fn is_app_running(config: &RuntimeConfig) -> Result<bool> {
    scan_proc_for_executable(&config.app_executable_path)
}

fn scan_proc_for_executable(expected: &Path) -> Result<bool> {
    let proc_dir = Path::new("/proc");
    for entry in fs::read_dir(proc_dir).context("Failed to read /proc")? {
        let entry = entry?;
        let Some(file_name) = entry.file_name().to_str().map(str::to_string) else {
            continue;
        };
        let Ok(pid) = file_name.parse::<u32>() else {
            continue;
        };

        if process_matches(pid, expected) {
            return Ok(true);
        }
    }

    Ok(false)
}

fn process_matches(pid: u32, expected: &Path) -> bool {
    is_process_alive(pid)
        && read_exe_link(pid)
            .map(|path| executable_path_matches(&path, expected))
            .unwrap_or(false)
}

fn executable_path_matches(actual: &Path, expected: &Path) -> bool {
    actual == expected
        || actual.as_os_str().as_bytes().strip_suffix(b" (deleted)")
            == Some(expected.as_os_str().as_bytes())
}

fn is_process_alive(pid: u32) -> bool {
    Path::new("/proc").join(pid.to_string()).exists()
}

fn read_exe_link(pid: u32) -> Result<PathBuf> {
    fs::read_link(Path::new("/proc").join(pid.to_string()).join("exe"))
        .with_context(|| format!("Failed to read /proc/{pid}/exe"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::Result;

    #[test]
    fn current_process_is_not_mistaken_for_electron() -> Result<()> {
        let mut config = crate::config::RuntimeConfig::default_with_paths(
            &crate::config::RuntimePaths::detect()?,
        );
        config.app_executable_path = PathBuf::from("/opt/codex-desktop/ChatGPT");

        assert!(!process_matches(
            std::process::id(),
            &config.app_executable_path
        ));
        Ok(())
    }

    #[test]
    fn deleted_executable_still_matches_exact_managed_path() {
        let expected = Path::new("/opt/codex-desktop/ChatGPT");
        assert!(executable_path_matches(expected, expected));
        assert!(executable_path_matches(
            Path::new("/opt/codex-desktop/ChatGPT (deleted)"),
            expected
        ));
    }

    #[test]
    fn deleted_suffix_does_not_match_another_executable() {
        let expected = Path::new("/opt/codex-desktop/ChatGPT");
        assert!(!executable_path_matches(
            Path::new("/other/codex-desktop/ChatGPT (deleted)"),
            expected
        ));
        assert!(!executable_path_matches(
            Path::new("/opt/codex-desktop/ChatGPT-helper (deleted)"),
            expected
        ));
        assert!(!executable_path_matches(
            Path::new("/opt/codex-desktop/ChatGPT (deleted) (deleted)"),
            expected
        ));
    }
}
