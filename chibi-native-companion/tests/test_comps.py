from chibi.comps import Comp, CompCatalog


class FakeClient:
    def get_comps(self, queue_id: int):
        assert queue_id == 1100
        return {
            "comps": [{
                "id": "Bruiser|RiftHerald",
                "games": 18,
                "averagePlacement": 3.42,
                "top4Rate": 72.2,
                "traits": [{"id": "TFT13_Bruiser"}, {"id": "TFT13_RiftHerald"}],
                "units": [{"id": "TFT13_Warwick"}, {"id": "TFT13_RekSai"}, {"id": "TFT13_Azir"}],
                "items": [{"id": "TFT_Item_GuinsoosRageblade"}],
                "unitItems": [{"unitId": "TFT13_Warwick", "items": [{"id": "TFT_Item_GuinsoosRageblade"}]}],
            }],
        }


def test_catalog_caches_and_converts_observed_comp_to_game_plan(tmp_path):
    catalog = CompCatalog(FakeClient(), tmp_path / "cache" / "comps.json")
    comps = catalog.fetch()
    assert len(comps) == 1
    assert catalog.load_cache()[0].units[0] == "TFT13_Warwick"
    plan = comps[0].to_plan()
    assert plan.primary_comp
    assert plan.carries == ["TFT13_Warwick", "TFT13_RekSai"]
    assert plan.carry_items == ["TFT_Item_GuinsoosRageblade"]
    assert plan.level_plan and plan.roll_plan


def test_comp_name_is_derived_from_public_traits_not_manual_catalog():
    comp = Comp("id", 2, 4.0, 50.0, ("TFT13_Bruiser",), (), (), ())
    assert "Bruiser" in comp.name
