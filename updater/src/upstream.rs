//! Upstream archive metadata and download helpers.

use anyhow::{anyhow, Context, Result};
use chrono::{DateTime, Utc};
use futures_util::StreamExt;
use quick_xml::{events::Event, reader::Reader};
use reqwest::{header, Client};
use sha2::{Digest, Sha256};
use std::path::{Path, PathBuf};
use tokio::{fs::File, io::AsyncWriteExt};

#[derive(Debug, Clone, PartialEq, Eq)]
/// Selected HTTP metadata used to detect upstream archive changes.
pub struct RemoteMetadata {
    pub etag: Option<String>,
    pub last_modified: Option<String>,
    pub content_length: Option<u64>,
    pub headers_fingerprint: String,
    pub download_url: String,
    pub candidate_version: Option<String>,
    pub upstream_version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
/// Result of downloading the current upstream archive snapshot.
pub struct DownloadedDmg {
    pub path: PathBuf,
    pub sha256: String,
    pub candidate_version: String,
    pub upstream_version: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct AppcastRelease {
    upstream_version: String,
    candidate_version: String,
    download_url: String,
    content_length: Option<u64>,
}

/// Fetches the upstream release metadata used to detect candidate updates.
pub async fn fetch_remote_metadata(
    client: &Client,
    dmg_url: &str,
    appcast_url: Option<&str>,
) -> Result<RemoteMetadata> {
    if let Some(appcast_url) = appcast_url.filter(|url| !url.trim().is_empty()) {
        return fetch_appcast_metadata(client, dmg_url, appcast_url).await;
    }

    let response = client
        .head(dmg_url)
        .send()
        .await
        .with_context(|| format!("Failed HEAD request for {dmg_url}"))?
        .error_for_status()
        .with_context(|| format!("HEAD request for {dmg_url} returned an error status"))?;

    let etag = response
        .headers()
        .get(header::ETAG)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let last_modified = response
        .headers()
        .get(header::LAST_MODIFIED)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let content_length = response
        .headers()
        .get(header::CONTENT_LENGTH)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.parse::<u64>().ok());

    let headers_fingerprint = format!(
        "etag={}|last_modified={}|content_length={}",
        etag.as_deref().unwrap_or(""),
        last_modified.as_deref().unwrap_or(""),
        content_length
            .map(|value| value.to_string())
            .as_deref()
            .unwrap_or("")
    );

    Ok(RemoteMetadata {
        etag,
        last_modified,
        content_length,
        headers_fingerprint,
        download_url: dmg_url.to_string(),
        candidate_version: None,
        upstream_version: None,
    })
}

async fn fetch_appcast_metadata(
    client: &Client,
    fallback_dmg_url: &str,
    appcast_url: &str,
) -> Result<RemoteMetadata> {
    let response = client
        .get(appcast_url)
        .send()
        .await
        .with_context(|| format!("Failed GET request for {appcast_url}"))?
        .error_for_status()
        .with_context(|| format!("GET request for {appcast_url} returned an error status"))?;

    let etag = response
        .headers()
        .get(header::ETAG)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let last_modified = response
        .headers()
        .get(header::LAST_MODIFIED)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);
    let body = response
        .text()
        .await
        .with_context(|| format!("Failed reading appcast body from {appcast_url}"))?;
    let release = parse_latest_appcast_release(&body)?;

    let headers_fingerprint = format!(
        "appcast={appcast_url}|etag={}|last_modified={}|upstream_version={}|download_url={}|content_length={}",
        etag.as_deref().unwrap_or(""),
        last_modified.as_deref().unwrap_or(""),
        release.upstream_version,
        release.download_url,
        release
            .content_length
            .map(|value| value.to_string())
            .as_deref()
            .unwrap_or("")
    );

    Ok(RemoteMetadata {
        etag,
        last_modified,
        content_length: release.content_length,
        headers_fingerprint,
        download_url: if release.download_url.is_empty() {
            fallback_dmg_url.to_string()
        } else {
            release.download_url
        },
        candidate_version: Some(release.candidate_version),
        upstream_version: Some(release.upstream_version),
    })
}

/// Downloads the upstream archive and derives a package version from its hash.
pub async fn download_dmg(
    client: &Client,
    download_url: &str,
    destination_dir: &Path,
    version_timestamp: DateTime<Utc>,
    preferred_candidate_version: Option<&str>,
    upstream_version: Option<&str>,
) -> Result<DownloadedDmg> {
    tokio::fs::create_dir_all(destination_dir)
        .await
        .with_context(|| format!("Failed to create {}", destination_dir.display()))?;

    let destination = destination_dir.join(download_file_name(download_url));
    let mut file = File::create(&destination)
        .await
        .with_context(|| format!("Failed to create {}", destination.display()))?;

    let response = client
        .get(download_url)
        .send()
        .await
        .with_context(|| format!("Failed GET request for {download_url}"))?
        .error_for_status()
        .with_context(|| format!("GET request for {download_url} returned an error status"))?;

    let mut hasher = Sha256::new();
    let mut stream = response.bytes_stream();

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.with_context(|| format!("Failed downloading {download_url}"))?;
        file.write_all(&chunk)
            .await
            .with_context(|| format!("Failed writing {}", destination.display()))?;
        hasher.update(&chunk);
    }

    file.flush()
        .await
        .with_context(|| format!("Failed flushing {}", destination.display()))?;

    let sha256 = hasher
        .finalize()
        .iter()
        .map(|byte| format!("{byte:02x}"))
        .collect::<String>();
    let candidate_version = preferred_candidate_version
        .map(str::to_string)
        .unwrap_or(derive_candidate_version(&sha256, version_timestamp)?);

    Ok(DownloadedDmg {
        path: destination,
        sha256,
        candidate_version,
        upstream_version: upstream_version.map(str::to_string),
    })
}

/// Derives a local package version from the archive hash and download timestamp.
pub fn derive_candidate_version(sha256: &str, timestamp: DateTime<Utc>) -> Result<String> {
    let short_hash = sha256
        .get(0..8)
        .ok_or_else(|| anyhow!("sha256 is too short to derive candidate version"))?;
    Ok(format!(
        "{}+{}",
        timestamp.format("%Y.%m.%d.%H%M%S"),
        short_hash
    ))
}

fn parse_latest_appcast_release(xml: &str) -> Result<AppcastRelease> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut buf = Vec::new();
    let mut in_item = false;
    let mut current_element: Option<Vec<u8>> = None;
    let mut title: Option<String> = None;
    let mut short_version: Option<String> = None;
    let mut pub_date: Option<String> = None;
    let mut enclosure_url: Option<String> = None;
    let mut enclosure_length: Option<u64> = None;

    loop {
        match reader.read_event_into(&mut buf) {
            Ok(Event::Start(event)) => {
                let name = event.name().as_ref().to_vec();
                if name.as_slice() == b"item" {
                    in_item = true;
                } else if in_item {
                    if name.as_slice() == b"enclosure" && enclosure_url.is_none() {
                        for attribute in event.attributes() {
                            let attribute = attribute?;
                            match attribute.key.as_ref() {
                                b"url" => {
                                    enclosure_url =
                                        Some(String::from_utf8_lossy(&attribute.value).to_string())
                                }
                                b"length" => {
                                    enclosure_length = String::from_utf8_lossy(&attribute.value)
                                        .parse::<u64>()
                                        .ok()
                                }
                                _ => {}
                            }
                        }
                    }
                    current_element = Some(name);
                }
            }
            Ok(Event::Empty(event))
                if in_item && event.name().as_ref() == b"enclosure" && enclosure_url.is_none() =>
            {
                for attribute in event.attributes() {
                    let attribute = attribute?;
                    match attribute.key.as_ref() {
                        b"url" => {
                            enclosure_url =
                                Some(String::from_utf8_lossy(&attribute.value).to_string())
                        }
                        b"length" => {
                            enclosure_length = String::from_utf8_lossy(&attribute.value)
                                .parse::<u64>()
                                .ok()
                        }
                        _ => {}
                    }
                }
            }
            Ok(Event::Text(event)) if in_item => {
                let text = event.decode()?.into_owned();
                match current_element.as_deref() {
                    Some(b"title") if title.is_none() => title = Some(text),
                    Some(b"sparkle:shortVersionString") if short_version.is_none() => {
                        short_version = Some(text)
                    }
                    Some(b"pubDate") if pub_date.is_none() => pub_date = Some(text),
                    _ => {}
                }
            }
            Ok(Event::End(event)) => {
                if event.name().as_ref() == b"item" && in_item {
                    break;
                }
                current_element = None;
            }
            Ok(Event::Eof) => break,
            Err(error) => {
                return Err(error).with_context(|| {
                    format!(
                        "Failed to parse appcast at byte {}",
                        reader.error_position()
                    )
                });
            }
            _ => {}
        }
        buf.clear();
    }

    let upstream_version = short_version
        .or(title)
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .context("Appcast did not contain a release version")?;
    let download_url = enclosure_url
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .context("Appcast did not contain a release enclosure URL")?;
    let timestamp = pub_date
        .as_deref()
        .and_then(|value| DateTime::parse_from_rfc2822(value).ok())
        .map(|value| value.with_timezone(&Utc))
        .unwrap_or_else(Utc::now);
    let candidate_version = derive_appcast_candidate_version(&upstream_version, timestamp);

    Ok(AppcastRelease {
        upstream_version,
        candidate_version,
        download_url,
        content_length: enclosure_length,
    })
}

fn derive_appcast_candidate_version(upstream_version: &str, timestamp: DateTime<Utc>) -> String {
    let suffix = sanitize_package_version_suffix(upstream_version);
    format!("{}+{}", timestamp.format("%Y.%m.%d.%H%M%S"), suffix)
}

fn sanitize_package_version_suffix(value: &str) -> String {
    let mut suffix = String::new();
    let mut previous_was_dot = false;
    for ch in value.chars() {
        let next = if ch.is_ascii_alphanumeric() || ch == '.' {
            ch
        } else {
            '.'
        };
        if next == '.' {
            if previous_was_dot {
                continue;
            }
            previous_was_dot = true;
        } else {
            previous_was_dot = false;
        }
        suffix.push(next);
    }

    let suffix = suffix.trim_matches('.');
    if suffix.is_empty() {
        "upstream".to_string()
    } else {
        suffix.to_string()
    }
}

fn download_file_name(download_url: &str) -> String {
    download_url
        .split('?')
        .next()
        .and_then(|without_query| without_query.rsplit('/').next())
        .filter(|name| !name.is_empty())
        .filter(|name| !name.contains('/') && !name.contains('\\'))
        .unwrap_or("Codex.dmg")
        .to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use anyhow::Result;
    use chrono::TimeZone;
    use tempfile::tempdir;
    use wiremock::{
        matchers::{method, path},
        Mock, MockServer, ResponseTemplate,
    };

    #[tokio::test]
    async fn fetches_remote_metadata_from_head() -> Result<()> {
        let server = MockServer::start().await;
        Mock::given(method("HEAD"))
            .and(path("/Codex.dmg"))
            .respond_with(
                ResponseTemplate::new(200)
                    .insert_header("ETag", "\"abc\"")
                    .insert_header("Last-Modified", "Tue, 25 Mar 2026 00:00:00 GMT")
                    .insert_header("Content-Length", "42"),
            )
            .mount(&server)
            .await;

        let client = Client::builder().build()?;
        let metadata =
            fetch_remote_metadata(&client, &format!("{}/Codex.dmg", server.uri()), None).await?;
        assert_eq!(metadata.etag.as_deref(), Some("\"abc\""));
        assert_eq!(
            metadata.last_modified.as_deref(),
            Some("Tue, 25 Mar 2026 00:00:00 GMT")
        );
        assert_eq!(metadata.content_length, Some(42));
        assert!(metadata.headers_fingerprint.contains("etag=\"abc\""));
        assert_eq!(metadata.download_url, format!("{}/Codex.dmg", server.uri()));
        Ok(())
    }

    #[tokio::test]
    async fn fetches_latest_release_from_appcast() -> Result<()> {
        let server = MockServer::start().await;
        let appcast = format!(
            r#"<?xml version='1.0' encoding='utf-8'?>
<rss xmlns:sparkle="http://www.andymatuschak.org/xml-namespaces/sparkle" version="2.0">
  <channel>
    <item>
      <title>26.513.31313</title>
      <pubDate>Fri, 15 May 2026 18:36:14 -0700</pubDate>
      <sparkle:shortVersionString>26.513.31313</sparkle:shortVersionString>
      <enclosure url="{}/Codex-darwin-x64-26.513.31313.zip" length="338767820" type="application/octet-stream" />
    </item>
  </channel>
</rss>"#,
            server.uri()
        );
        Mock::given(method("GET"))
            .and(path("/appcast-x64.xml"))
            .respond_with(
                ResponseTemplate::new(200)
                    .insert_header("ETag", "\"appcast\"")
                    .set_body_string(appcast),
            )
            .mount(&server)
            .await;

        let client = Client::builder().build()?;
        let metadata = fetch_remote_metadata(
            &client,
            &format!("{}/Codex.dmg", server.uri()),
            Some(&format!("{}/appcast-x64.xml", server.uri())),
        )
        .await?;

        assert_eq!(metadata.etag.as_deref(), Some("\"appcast\""));
        assert_eq!(metadata.content_length, Some(338767820));
        assert_eq!(
            metadata.download_url,
            format!("{}/Codex-darwin-x64-26.513.31313.zip", server.uri())
        );
        assert_eq!(metadata.upstream_version.as_deref(), Some("26.513.31313"));
        assert_eq!(
            metadata.candidate_version.as_deref(),
            Some("2026.05.16.013614+26.513.31313")
        );
        assert!(metadata
            .headers_fingerprint
            .contains("upstream_version=26.513.31313"));
        Ok(())
    }

    #[tokio::test]
    async fn downloads_dmg_and_hashes_contents() -> Result<()> {
        let server = MockServer::start().await;
        let body = b"codex-dmg-test-payload";
        Mock::given(method("GET"))
            .and(path("/Codex.dmg"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(body.to_vec()))
            .mount(&server)
            .await;

        let client = Client::builder().build()?;
        let temp = tempdir()?;
        let downloaded = download_dmg(
            &client,
            &format!("{}/Codex.dmg", server.uri()),
            temp.path(),
            Utc.with_ymd_and_hms(2026, 3, 24, 12, 0, 0).unwrap(),
            None,
            None,
        )
        .await?;

        assert_eq!(downloaded.path, temp.path().join("Codex.dmg"));
        assert_eq!(
            downloaded.sha256,
            "678cd508ffe0071e217020a7a4eecbebe25362c022ac78c13a5ae87b7a3a0c92"
        );
        assert_eq!(downloaded.candidate_version, "2026.03.24.120000+678cd508");
        Ok(())
    }

    #[tokio::test]
    async fn downloads_versioned_archive_with_preferred_candidate_version() -> Result<()> {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/Codex-darwin-x64-26.513.31313.zip"))
            .respond_with(ResponseTemplate::new(200).set_body_bytes(b"zip".to_vec()))
            .mount(&server)
            .await;

        let client = Client::builder().build()?;
        let temp = tempdir()?;
        let downloaded = download_dmg(
            &client,
            &format!("{}/Codex-darwin-x64-26.513.31313.zip", server.uri()),
            temp.path(),
            Utc.with_ymd_and_hms(2026, 3, 24, 12, 0, 0).unwrap(),
            Some("2026.05.16.013614+26.513.31313"),
            Some("26.513.31313"),
        )
        .await?;

        assert_eq!(
            downloaded.path,
            temp.path().join("Codex-darwin-x64-26.513.31313.zip")
        );
        assert_eq!(
            downloaded.candidate_version,
            "2026.05.16.013614+26.513.31313"
        );
        assert_eq!(downloaded.upstream_version.as_deref(), Some("26.513.31313"));
        Ok(())
    }

    #[test]
    fn appcast_candidate_version_suffix_is_package_portable() {
        let version = derive_appcast_candidate_version(
            "26.513 beta/rc-1",
            Utc.with_ymd_and_hms(2026, 5, 16, 1, 36, 14).unwrap(),
        );

        assert_eq!(version, "2026.05.16.013614+26.513.beta.rc.1");
    }

    #[test]
    fn derive_candidate_version_rejects_short_hashes() {
        let error = derive_candidate_version("short", Utc::now()).expect_err("hash should fail");
        assert!(error.to_string().contains("sha256 is too short"));
    }
}
