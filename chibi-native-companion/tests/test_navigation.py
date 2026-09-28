from chibi.navigation import build_analysis_url


def test_analysis_url_uses_existing_study_contract() -> None:
    assert build_analysis_url("Alchemy Flames", "BR1", "br1", "BR1_123", "flexibility") == "https://chibi.gg/?player=Alchemy+Flames&tag=BR1&region=br1&tab=matches&study=BR1_123&source=native&sessionFocus=flexibility"


def test_analysis_url_encodes_riot_id_characters() -> None:
    url = build_analysis_url("Álchemy # Flames", "BR 1", "BR1", "BR1_ç?", "itens & tempo")
    assert "player=%C3%81lchemy+%23+Flames" in url
    assert "tag=BR+1" in url and "study=BR1_%C3%A7%3F" in url and "sessionFocus=itens+%26+tempo" in url
