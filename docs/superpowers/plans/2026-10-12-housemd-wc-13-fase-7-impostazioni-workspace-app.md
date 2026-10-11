# HouseMD Web Components — Piano 13: fase 7, impostazioni, workspace e app senza React

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Bozza in corso (LAB-49).** Le sezioni si completano e si committano una alla volta; finché questa nota c'è il piano non è pronto per l'esecuzione.

**Goal:** Portare a custom element l'ultimo strato React (impostazioni, workspace, app) e togliere React.

## Misure prese scrivendo il piano (12/10, su `5fa9abf`)

Baseline su `5fa9abf` (= `epic/LAB-3-web-components`, 6c mergiata) nel prototipo `/home/agent/work/housemd-proto-7`: `npm test` = **980** (45 s); `npm run test:e2e` = **187** (185 verdi + i 2 snapshot dello start screen, già noti; 2,8 min con 2 worker); `npm run test:e2e:dev` = **172** (5,0 min); `npm run test:e2e:audit` = **116** (3,5 min); bundle principale gzip = **441 143 B** (`dist/assets/index-BP09-t2V.js`).
