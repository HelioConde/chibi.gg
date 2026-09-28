# Fontes de dados TFT

| Dado | Fonte | Status |
| --- | --- | --- |
| Riot ID | LCU | VERIFIED |
| ReadyCheck | LCU | VERIFIED |
| Stage | Overwolf GEP | NOT TESTED — aguarda payload real e teste controlado |
| Gold | Overwolf GEP | NOT TESTED — aguarda payload real e teste controlado |
| HP | Overwolf GEP | NOT TESTED — aguarda payload real e teste controlado |
| Level | Overwolf GEP | NOT TESTED — aguarda payload real e teste controlado |
| Board | Overwolf GEP | NOT TESTED — aguarda payload real e teste controlado |
| Bench | Overwolf GEP | NOT TESTED — aguarda payload real e teste controlado |
| Store | Overwolf GEP | NOT TESTED — aguarda payload real e teste controlado |

O LCU continua sendo a fonte de gameflow. A telemetria Overwolf é independente e não é renderizada no overlay até haver payload real observado e uma revisão de política antes de qualquer lançamento.

## Ciclo de validação Overwolf

`NOT TESTED` significa que o campo ainda não apareceu em um payload real. `OBSERVED` significa que o primeiro payload sanitizado foi registrado em `%APPDATA%\\ChibiOverlay\\debug`. `VERIFIED` exige a comparação manual com o valor visível no jogo após uma alteração controlada. `UNAVAILABLE` é usado somente quando a fonte real informa que o campo não é suportado.

Os relatórios `overwolf-status.json` e `overwolf-validation-report.json` não promovem campos para `VERIFIED` automaticamente.
