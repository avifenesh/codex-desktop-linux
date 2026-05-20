//! Runtime configuration loading and XDG path discovery for the updater.

use anyhow::{Context, Result};
use directories::BaseDirs;
use serde::{Deserialize, Serialize};
use std::{fs, path::PathBuf};

const SERVICE_NAME: &str = "codex-update-manager";

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
/// Runtime configuration values that control how the updater behaves on Linux.
pub struct RuntimeConfig {
    pub dmg_url: String,
    #[serde(default = "default_appcast_url")]
    pub appcast_url: Option<String>,
    pub initial_check_delay_seconds: u64,
    pub check_interval_hours: u64,
    pub auto_install_on_app_exit: bool,
    pub notifications: bool,
    pub workspace_root: PathBuf,
    pub builder_bundle_root: PathBuf,
    pub app_executable_path: PathBuf,
}

#[derive(Debug, Clone)]
/// Resolved XDG filesystem locations used by the updater at runtime.
pub struct RuntimePaths {
    pub config_file: PathBuf,
    pub state_file: PathBuf,
    pub log_file: PathBuf,
    pub cache_dir: PathBuf,
    pub state_dir: PathBuf,
    pub config_dir: PathBuf,
}

impl RuntimePaths {
    /// Resolves updater paths from the current user's XDG base directories.
    pub fn from_base_dirs(base_dirs: &BaseDirs) -> Self {
        let config_dir = base_dirs.config_dir().join(SERVICE_NAME);
        let state_root = base_dirs
            .state_dir()
            .unwrap_or_else(|| base_dirs.data_local_dir());
        let state_dir = state_root.join(SERVICE_NAME);
        let cache_dir = base_dirs.cache_dir().join(SERVICE_NAME);

        Self {
            config_file: config_dir.join("config.toml"),
            state_file: state_dir.join("state.json"),
            log_file: state_dir.join("service.log"),
            cache_dir,
            state_dir,
            config_dir,
        }
    }

    /// Detects updater paths for the current machine.
    pub fn detect() -> Result<Self> {
        let base_dirs = BaseDirs::new().context("Could not resolve XDG base directories")?;
        Ok(Self::from_base_dirs(&base_dirs))
    }

    /// Creates the runtime directories needed by the updater.
    pub fn ensure_dirs(&self) -> Result<()> {
        fs::create_dir_all(&self.config_dir)
            .with_context(|| format!("Failed to create {}", self.config_dir.display()))?;
        fs::create_dir_all(&self.state_dir)
            .with_context(|| format!("Failed to create {}", self.state_dir.display()))?;
        fs::create_dir_all(&self.cache_dir)
            .with_context(|| format!("Failed to create {}", self.cache_dir.display()))?;
        Ok(())
    }
}

impl RuntimeConfig {
    /// Builds the default runtime configuration for the resolved paths.
    pub fn default_with_paths(paths: &RuntimePaths) -> Self {
        let packaged_bundle_root = PathBuf::from("/opt/codex-desktop/update-builder");
        let builder_bundle_root = if packaged_bundle_root.exists() {
            packaged_bundle_root
        } else {
            PathBuf::from(env!("CARGO_MANIFEST_DIR"))
                .parent()
                .expect("updater crate should live inside the repository root")
                .to_path_buf()
        };

        Self {
            dmg_url: "https://persistent.oaistatic.com/codex-app-prod/Codex.dmg".to_string(),
            appcast_url: default_appcast_url(),
            initial_check_delay_seconds: 30,
            check_interval_hours: 6,
            auto_install_on_app_exit: true,
            notifications: true,
            workspace_root: paths.cache_dir.clone(),
            builder_bundle_root,
            app_executable_path: PathBuf::from("/opt/codex-desktop/electron"),
        }
    }

    /// Loads the runtime configuration from disk, or returns defaults if missing.
    pub fn load_or_default(paths: &RuntimePaths) -> Result<Self> {
        if !paths.config_file.exists() {
            return Ok(Self::default_with_paths(paths));
        }

        let content = fs::read_to_string(&paths.config_file)
            .with_context(|| format!("Failed to read {}", paths.config_file.display()))?;
        let config = toml::from_str::<Self>(&content)
            .with_context(|| format!("Failed to parse {}", paths.config_file.display()))?;
        Ok(config)
    }
}

fn default_appcast_url() -> Option<String> {
    Some(match std::env::consts::ARCH {
        "x86_64" => "https://persistent.oaistatic.com/codex-app-prod/appcast-x64.xml".to_string(),
        _ => "https://persistent.oaistatic.com/codex-app-prod/appcast.xml".to_string(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::Result;
    use tempfile::tempdir;

    #[test]
    fn loads_default_when_config_is_missing() -> Result<()> {
        let temp = tempdir()?;
        let paths = RuntimePaths {
            config_file: temp.path().join("config/config.toml"),
            state_file: temp.path().join("state/state.json"),
            log_file: temp.path().join("state/service.log"),
            cache_dir: temp.path().join("cache"),
            state_dir: temp.path().join("state"),
            config_dir: temp.path().join("config"),
        };

        let config = RuntimeConfig::load_or_default(&paths)?;
        assert_eq!(config.initial_check_delay_seconds, 30);
        assert!(config.appcast_url.as_deref().is_some_and(
            |url| url.starts_with("https://persistent.oaistatic.com/codex-app-prod/appcast")
        ));
        assert!(config.auto_install_on_app_exit);
        assert_eq!(config.workspace_root, paths.cache_dir);
        assert!(config.builder_bundle_root.is_absolute());
        Ok(())
    }

    #[test]
    fn parses_runtime_config_from_disk() -> Result<()> {
        let temp = tempdir()?;
        let paths = RuntimePaths {
            config_file: temp.path().join("config/config.toml"),
            state_file: temp.path().join("state/state.json"),
            log_file: temp.path().join("state/service.log"),
            cache_dir: temp.path().join("cache"),
            state_dir: temp.path().join("state"),
            config_dir: temp.path().join("config"),
        };
        fs::create_dir_all(&paths.config_dir)?;
        fs::write(
            &paths.config_file,
            r#"
dmg_url = "https://example.com/Codex.dmg"
appcast_url = "https://example.com/appcast.xml"
initial_check_delay_seconds = 5
check_interval_hours = 12
auto_install_on_app_exit = false
notifications = false
workspace_root = "/tmp/codex-workspaces"
builder_bundle_root = "/tmp/codex-builder"
app_executable_path = "/opt/codex-desktop/electron"
"#,
        )?;

        let config = RuntimeConfig::load_or_default(&paths)?;
        assert_eq!(config.dmg_url, "https://example.com/Codex.dmg");
        assert_eq!(
            config.appcast_url.as_deref(),
            Some("https://example.com/appcast.xml")
        );
        assert_eq!(config.initial_check_delay_seconds, 5);
        assert_eq!(config.check_interval_hours, 12);
        assert!(!config.auto_install_on_app_exit);
        assert!(!config.notifications);
        assert_eq!(
            config.workspace_root,
            PathBuf::from("/tmp/codex-workspaces")
        );
        assert_eq!(
            config.builder_bundle_root,
            PathBuf::from("/tmp/codex-builder")
        );
        assert_eq!(
            config.app_executable_path,
            PathBuf::from("/opt/codex-desktop/electron")
        );
        Ok(())
    }
}
