# Релизы (release-please)

Релизы собираются автоматически, вручную ничего бампать не нужно.

## Механика

- Пуш в main запускает `release-please.yml`: по **Conventional Commits** (`feat:`, `fix:`, …) он создаёт release-PR и тег `v*.*.*`.
- Версию в `package.json` поднимает release-please в своём release-PR.
- `release.yml` сверяет версию пакета с тегом и заливает `dist-<tag>.zip` в GitHub Release.

## Секреты

Для release-please нужен секрет `RELEASE_PLEASE_TOKEN` (fine-grained PAT): релиз/тег от обычного `GITHUB_TOKEN` не запустит `release.yml`.
