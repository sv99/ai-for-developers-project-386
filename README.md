# Календарь звонков

[![hexlet-check](https://github.com/sv99/ai-for-developers-project-386/actions/workflows/hexlet-check.yml/badge.svg)](https://github.com/sv99/ai-for-developers-project-386/actions)

Разработайте совместно с ИИ сервис для бронирования календаря

Учебный проект Хекслета: <https://ru.hexlet.io/programs/ai-for-developers>
Как это должно работать: <https://files.hexlet.app/a/2ipc5m>

## Стек

- TypeScript
- Vue
- Element-Plus
- Vite

Большую часть настройки сделал opencode модель GLM 5.3.
Отдельно настраивал release-please (раньше никогда не сталкивался), тоже под руководством Copilot в их новом варианте интерфейса Agents.

## Установка release-please

```bash
git clone https://github.com/sv99/ai-for-developers-project-386.git
cd ai-for-developers-project-386
```

Для работы `release-please` нужно:

1. добавить PAT ключ для репозитория с правами: Contents: Read and write, Pull requests: Read and write.
2. Добавить его в репозиторий как secret Settings → Secrets and variables → Actions → New repository secret с именем RELEASE_PLEASE_TOKEN.

## init

Инициализация проекта для работы с агентом.

```bash
/init
```

## Установка Skills

1. Установите набор скиллов:

```bash
npx skills@latest add mattpocock/skills
```

1. Проверьте, что агент видит скиллы: они должны появиться в списке доступных.
2. Запустите /setup-matt-pocock-skills

ответы на вопросы:

- трекер задач: GitHub Issues в репозитории проекта;
- метки для разбора задач: оставить значения по умолчанию;
- документы предметной области: один контекст, CONTEXT.md и docs/adr/ в корне репозитория

1. Посмотрите, что скилл записал в docs/agents/ и в AGENTS.md.
