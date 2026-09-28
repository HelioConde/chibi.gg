import json
from chibi.plan import GamePlan, GamePlanStore

def test_game_plan_limits_fallbacks_and_persists(tmp_path, monkeypatch):
    store=GamePlanStore(); store.path=tmp_path/"game-plan.json"
    plan=GamePlan.from_dict({"primary_comp":"Fera do Rift","fallback_comps":["A","B","C"],"core_units":["Warwick"],"level_plan":["Lv 6 → estabilizar"]})
    store.save(plan)
    assert store.load().primary_comp=="Fera do Rift" and store.load().fallback_comps==["A","B"]
