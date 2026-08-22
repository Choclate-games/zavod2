"""
Репозиторий каталога игровых механик (config/mechanics.yaml).

Отвечает за:
1. Загрузку и быстрый подбор механик из базы (1000+ механик) по ключевым словам и жанру.
2. Предоставление релевантных референсов механик агентам (IdeaAnalyzer, MechanicsArchitect).
3. Автоматическое сохранение новых уникальных механик, созданных ИИ, в каталог config/mechanics.yaml.
"""

from __future__ import annotations

import random
import re
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional
import yaml

from app.config import CONFIG_DIR
from app.logging import log_info, log_warning


def _slugify(text: str) -> str:
    translit = {
        "а": "a", "б": "b", "в": "v", "г": "g", "д": "d", "е": "e", "ё": "e", "ж": "zh",
        "з": "z", "и": "i", "й": "y", "к": "k", "л": "l", "м": "m", "н": "n", "о": "o",
        "п": "p", "р": "r", "с": "s", "т": "t", "у": "u", "ф": "f", "х": "h", "ц": "ts",
        "ч": "ch", "ш": "sh", "щ": "sch", "ъ": "", "ы": "y", "ь": "", "э": "e",
        "ю": "yu", "я": "ya",
    }
    latin = "".join(translit.get(ch, ch) for ch in (text or "").lower())
    clean = re.sub(r"[^a-z0-9]+", "_", latin).strip("_")
    return clean[:50] or "custom_mechanic"


class MechanicsRepository:
    """Синглтон-репозиторий для доступа и пополнения базы механик."""

    _instance: Optional[MechanicsRepository] = None
    _lock = threading.Lock()

    def __init__(self, yaml_path: Optional[Path] = None):
        self.yaml_path = Path(yaml_path) if yaml_path else CONFIG_DIR / "mechanics.yaml"
        self._data: Dict[str, Any] = {}
        self._mechanics_dict: Dict[str, Dict[str, Any]] = {}
        self._name_index: Dict[str, str] = {}
        self.reload()

    @classmethod
    def get_instance(cls) -> MechanicsRepository:
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def reload(self) -> None:
        """Перезагружает базу из YAML-файла."""
        if not self.yaml_path.exists():
            self._data = {"version": "2.1.0", "total_mechanics": 0, "mechanics": {}}
            self._mechanics_dict = {}
            self._name_index = {}
            return

        try:
            with open(self.yaml_path, "r", encoding="utf-8") as f:
                self._data = yaml.safe_load(f) or {}
        except Exception as exc:
            log_warning(f"Ошибка загрузки {self.yaml_path}: {exc}")
            self._data = {"version": "2.1.0", "total_mechanics": 0, "mechanics": {}}

        self._mechanics_dict = self._data.get("mechanics") or {}
        self._name_index = {
            m.get("name", "").strip().lower(): key
            for key, m in self._mechanics_dict.items()
            if isinstance(m, dict) and m.get("name")
        }

    @property
    def total_count(self) -> int:
        return len(self._mechanics_dict)

    def find_relevant(self, query: str, limit: int = 5) -> List[Dict[str, Any]]:
        """Ищет наиболее подходящие механики по текстовому описанию идеи."""
        if not self._mechanics_dict:
            return []

        words = set(re.findall(r"\w{3,}", (query or "").lower()))
        if not words:
            return list(self._mechanics_dict.values())[:limit]

        scored: List[tuple[int, Dict[str, Any]]] = []
        for m_key, m_val in self._mechanics_dict.items():
            if not isinstance(m_val, dict):
                continue
            name = (m_val.get("name") or "").lower()
            desc = (m_val.get("description") or "").lower()
            cat = (m_val.get("category") or "").lower()
            strengths = " ".join(m_val.get("strengths") or []).lower()

            score = 0
            for w in words:
                if w in name:
                    score += 5
                if w in cat:
                    score += 3
                if w in desc:
                    score += 2
                if w in strengths:
                    score += 1

            if score > 0:
                scored.append((score, m_val))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored[:limit]]

    def domains(self) -> List[str]:
        """Домены каталога — только настоящие, без мусора от обратной записи.

        Доменом считается категория, под которой лежит хотя бы три механики:
        каталог собирался как 24 домена по 42 штуки, а одиночные категории —
        это следы записи механик прошлых прогонов, где в поле category уехало
        предложение из role_in_loop."""
        counts: Dict[str, int] = {}
        for value in self._mechanics_dict.values():
            if isinstance(value, dict):
                category = (value.get("category") or "").strip()
                if category:
                    counts[category] = counts.get(category, 0) + 1
        return sorted(c for c, n in counts.items() if n >= 3)

    def sample_for_mixing(self, query: str, near: int = 3, far: int = 3) -> List[Dict[str, Any]]:
        """Кандидаты на смешивание: близкие к идее и заведомо далёкие от неё.

        Каталог из тысячи механик не заменяет модель — она и сама придумает
        «выстрел» для шутера. Его ценность в другом: это отполированный словарь
        из 24 доменов, и он позволяет свести в одну игру то, что рядом обычно не
        оказывается. Поэтому выборка идёт по доменам, а не по релевантности:
        не больше одной механики из домена, `near` доменов ближайших к идее и
        `far` — из тех, которых в топе нет вовсе.

        Далёкая механика — предложение, а не требование: она уместна ровно
        настолько, насколько её удаётся связать с фантазией игрока."""
        if not self._mechanics_dict:
            return []

        ranked = self.find_relevant(query, limit=200)
        picked: List[Dict[str, Any]] = []
        used_domains: set = set()
        for item in ranked:
            domain = (item.get("category") or "").strip()
            if not domain or domain in used_domains:
                continue
            used_domains.add(domain)
            picked.append({**item, "_distance": "близкая"})
            if len(picked) >= near:
                break

        remaining = [d for d in self.domains() if d not in used_domains]
        random.shuffle(remaining)
        for domain in remaining[:far]:
            pool = [v for v in self._mechanics_dict.values()
                    if isinstance(v, dict) and (v.get("category") or "").strip() == domain]
            if pool:
                picked.append({**random.choice(pool), "_distance": "далёкая"})
        return picked

    def format_for_mixing(self, mechanics: List[Dict[str, Any]]) -> str:
        """Кандидаты на смешивание с доменом и расстоянием до идеи.

        Механика, чья категория не входит в домены каталога, пришла не из
        исходной тысячи, а из обратной записи прошлого прогона. Такую честнее
        пометить: повторять собственную прошлую игру — ровно та однотипность,
        от которой каталог должен спасать."""
        if not mechanics:
            return "- Каталог недоступен: спроектируй механики с нуля под фантазию игры."
        known = set(self.domains())
        lines = []
        for m in mechanics:
            distance = m.get("_distance", "")
            domain = (m.get("category") or "").strip()
            if domain in known:
                mark = f" · {distance} · домен `{domain}`"
            else:
                mark = f" · {distance} · ⚠ механика из прошлого прогона фабрики, повторять её целиком нельзя"
            lines.append(f"- **{m.get('name', 'Механика')}**{mark}: {m.get('description', '')}")
        return "\n".join(lines)

    def format_for_prompt(self, mechanics: List[Dict[str, Any]]) -> str:
        """Форматирует найденные механики для внедрения в системный промпт ИИ."""
        if not mechanics:
            return "- Базовые референсы: спроектируй механики с нуля под фантазию игры."
        lines = []
        for m in mechanics:
            name = m.get("name", "Механика")
            cat = m.get("category", "core")
            desc = m.get("description", "")
            lines.append(f"- **{name}** ({cat}): {desc}")
        return "\n".join(lines)

    @staticmethod
    def _clean_category(raw: Any, genre: str = "") -> str:
        """Категория — короткий ярлык домена, а не роль механики в петле.

        Раньше сюда падал `role_in_loop` — предложение вида «Главный двигатель
        темпа, основной инструмент…». Каталог из-за этого оброс полусотней
        категорий с одной механикой внутри, и выборка по доменам на них
        разваливалась."""
        text = " ".join(str(raw or "").split())
        if text and len(text) <= 40 and "," not in text and " и " not in text:
            return text
        fallback = " ".join(str(genre or "").split())
        return fallback[:40] if fallback else "custom"

    def register_and_persist_mechanics(
        self,
        mechanics: List[Any],
        genre: str = "",
        renderer: str = "threejs"
    ) -> int:
        """
        Сохраняет новые механики, созданные ИИ, в каталог config/mechanics.yaml.
        Возвращает количество добавленных новых механик.
        """
        if not mechanics:
            return 0

        added_count = 0
        with self._lock:
            for item in mechanics:
                if hasattr(item, "model_dump"):
                    data = item.model_dump()
                elif isinstance(item, dict):
                    data = item
                else:
                    continue

                name = (data.get("name") or "").strip()
                if not name or len(name) < 3:
                    continue

                name_lower = name.lower()
                if name_lower in self._name_index:
                    continue

                category = self._clean_category(data.get("category"), genre)
                cat_slug = _slugify(category)
                name_slug = _slugify(name)
                key = f"{cat_slug}_{name_slug}"
                if key in self._mechanics_dict:
                    key = f"{key}_{len(self._mechanics_dict) + 1}"

                desc = (
                    data.get("description")
                    or data.get("why_unique")
                    or data.get("player_decision")
                    or f"Механика «{name}»"
                )

                feedback = data.get("feedback") or "; ".join(data.get("feedback_layers") or [])
                strengths = data.get("strengths") or ["Высокая вовлеченность", "Глубокая кривая мастерства"]
                weaknesses = data.get("weaknesses") or ["Требует точной калибровки таймингов"]

                new_entry: Dict[str, Any] = {
                    "name": name,
                    "category": category,
                    "preferred_renderer": renderer,
                    "physics_engine": "rapier3d" if renderer == "threejs" else "matterjs",
                    "description": desc,
                    "strengths": strengths,
                    "weaknesses": weaknesses,
                }
                if feedback:
                    new_entry["feedback"] = feedback
                if data.get("input_mapping") or data.get("player_interaction"):
                    new_entry["player_interaction"] = data.get("input_mapping") or data.get("player_interaction")

                self._mechanics_dict[key] = new_entry
                self._name_index[name_lower] = key
                added_count += 1

            if added_count > 0:
                self._data["mechanics"] = self._mechanics_dict
                self._data["total_mechanics"] = len(self._mechanics_dict)
                try:
                    with open(self.yaml_path, "w", encoding="utf-8") as f:
                        yaml.safe_dump(
                            self._data,
                            f,
                            allow_unicode=True,
                            sort_keys=False,
                            default_flow_style=False
                        )
                    log_info(
                        f"[MechanicsRepo] Добавлено {added_count} новых механик в каталог "
                        f"(Всего в базе: {len(self._mechanics_dict)})"
                    )
                except Exception as exc:
                    log_warning(f"[MechanicsRepo] Не удалось сохранить mechanics.yaml: {exc}")

        return added_count
