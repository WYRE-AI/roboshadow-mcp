# Changelog

All notable changes to this project will be documented in this file. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

Per-version release notes for tagged releases are published on the [GitHub Releases page](https://github.com/WYRE-AI/roboshadow-mcp/releases) - `semantic-release` generates them from commit history at release time.

## [Unreleased]

### Added

- Initial v1 release: 40 read-only tools covering every GET operation in RoboShadow's Rubicon Platform Data API (endpoint security - antivirus, Windows Defender, firewall; asset/hardware inventory; applications; users; vulnerabilities; remediation status). The published spec defines no write/create/update/delete endpoint for organisation data anywhere - the only non-GET operation in the entire spec is the vendor's own bearer-token-refresh exchange (`POST /identity/bearertoken`), which this connector calls internally to keep its access token fresh and never exposes as a tool. Authenticates with a RoboShadow Refresh Token (Reports -> API Token in the portal), exchanged internally for a short-lived Bearer Token before each call. See README's Scope and Authentication sections for the full two-tier confidence split.
