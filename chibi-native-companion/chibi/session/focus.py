from dataclasses import dataclass

@dataclass(frozen=True, slots=True)
class SessionFocus:
    id: str
    label: str
    description: str

FOCUSES = (
    SessionFocus("economy", "Economia", "Planeje gastos e juros."),
    SessionFocus("positioning", "Posicionamento", "Observe o posicionamento antes de cada combate."),
    SessionFocus("flexibility", "Flexibilidade", "Não force composição cedo."),
    SessionFocus("items", "Itens", "Planeje itens antes de comprometer componentes."),
    SessionFocus("tempo", "Tempo", "Decida o ritmo de rolagem e nível."),
    SessionFocus("custom", "Personalizado", "Foco definido por você."),
)
