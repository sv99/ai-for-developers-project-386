-- +goose Up
-- Домен по GLOSSARY.md: Тип события, Запись. Слоты не хранятся — выводятся
-- из сетки дня минус активные Записи. Решения — в wayfinder-карте (#61):
-- полуинтервалы, снапшот длительности, EXCLUDE-инвариант двойной брони.

create table event_types (
    id uuid primary key default gen_random_uuid(),
    name text not null check (length(trim(name)) > 0),
    description text not null default '',
    duration_minutes int not null check (duration_minutes >= 1)
);

create table bookings (
    id uuid primary key default gen_random_uuid(),
    event_type_id uuid not null references event_types,
    date date not null,
    start_time time not null,
    duration_minutes int not null check (duration_minutes >= 1), -- снапшот на момент брони
    ends_at timestamp not null,                                  -- наивный, в OWNER_TZ (как весь домен)
    guest_name text not null check (length(trim(guest_name)) > 0),
    guest_phone text not null check (length(trim(guest_phone)) > 0),
    status text not null default 'active' check (status in ('active', 'cancelled')),
    created_at timestamptz not null default now(),

    -- консистентность снапшота с контрактовыми полями доказана БД
    constraint booking_duration_consistent
        check (ends_at = (date + start_time) + duration_minutes * interval '1 minute'),

    -- инвариант «нет пересечения активных Записей»: гонки невозможны by construction;
    -- нарушение — SQLSTATE 23P01, маппится в 409 «Это время уже занято…»
    constraint no_double_booking
        exclude using gist (tsrange((date + start_time), ends_at, '[)') with &&)
        where (status = 'active')
);

create table settings (
    key text primary key,
    value text not null
);

-- +goose Down
drop table bookings;
drop table event_types;
drop table settings;
