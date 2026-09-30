import gzip
import json
from types import SimpleNamespace

from chibi.recording.reconcile import reconcile
from chibi.recording.recorder import MatchSessionRecorder
from chibi.auth.secure_store import AuthSession, SecureTokenStore
from chibi.auth.client import SessionProvider
from chibi.tracker.events import EventType, TFTEvent
from chibi.tracker.models import BoardPiece, ChibiGameState, ObservedValue


def _gameflow(): return SimpleNamespace(player_puuid="owner", queue_id=1100, queue_name="TFT", details={"platform":"BR1"})

def _state():
    state=ChibiGameState(game_id="BR1_1", board=[BoardPiece("Leona","DA_18_Leona","Leona",True,1)], augments=["A"])
    state.player.hp=ObservedValue(80,"TFT_CHECKPOINT",1,1); state.player.gold=ObservedValue(42,"VISION",.9,1); state.player.level=ObservedValue(7,"VISION",.9,1)
    state.round=ObservedValue("3-2","VISION",.9,1); return state

def test_recorder_writes_only_own_state_and_finalizes_gzip(tmp_path):
    recorder=MatchSessionRecorder(tmp_path); state=_state(); recorder.start(_gameflow())
    recorder.event(TFTEvent(EventType.CHECKPOINT_UPDATED,"TFT_CHECKPOINT",{"players":[{"PUUID":"enemy"}],"health":80}),state)
    recorder.snapshot(state,force=True); package=recorder.finalize(state)
    assert package and package.exists() and recorder.status.state=="finalized"
    with gzip.open(package,"rt",encoding="utf-8") as source: data=json.load(source)
    assert "players" not in data["telemetry"]["events"][1]["payload"]
    assert data["telemetry"]["snapshots"][0]["board"][0]["display_name"]=="Leona"

def test_recorder_recovery_preserves_unfinished_file(tmp_path):
    recorder=MatchSessionRecorder(tmp_path); recorder.start(_gameflow())
    assert recorder.recover(False)
    assert list((tmp_path/"recovered").glob("*.jsonl"))

def test_riot_reconciliation_keeps_local_timeline_and_prefers_official_result():
    package={"telemetry":{"events":[{"type":"LEVEL_UPDATED","payload":{"value":7}}]}}
    result=reconcile(package,{"id":"BR1_1","participants":[{"puuid":"owner","level":8,"placement":4}]},"owner")
    assert result["riotMatch"]["participant"]["level"]==8
    assert result["telemetry"]["events"][0]["payload"]["value"]==7

def test_windows_dpapi_store_round_trips_without_plaintext(tmp_path):
    path=tmp_path/"session.dpapi"; store=SecureTokenStore(path)
    store.save_session(AuthSession("access-secret","refresh-secret",123,"user"))
    assert b"access-secret" not in path.read_bytes()
    assert store.load_session()==AuthSession("access-secret","refresh-secret",123,"user")
    store.clear_session(); assert not path.exists()


class _MemoryStore:
    def __init__(self, session):
        self.session=session
    def load_session(self):
        return self.session
    def save_session(self, session):
        self.session=session
    def clear_session(self):
        self.session=None


class _RefreshClient:
    def __init__(self, refreshed):
        self.refreshed=refreshed
        self.calls=0
    def refresh(self, refresh_token):
        self.calls+=1
        assert refresh_token=="refresh-old"
        return self.refreshed


def test_session_provider_refreshes_expiring_session():
    store=_MemoryStore(AuthSession("access-old","refresh-old",0,"user"))
    client=_RefreshClient(AuthSession("access-new","refresh-new",9999999999,"user"))
    provider=SessionProvider(store,client)
    assert provider()=="access-new"
    assert client.calls==1
    assert store.session.access_token=="access-new"


def test_recorder_finalizes_with_riot_compatible_match_id(tmp_path):
    class Snapshot:
        player_puuid="owner"
        queue_id=1100
        queue_name="TFT"
        details={"platform":"br1","game_id":"3288084282"}

    recorder=MatchSessionRecorder(tmp_path)
    recorder.start(Snapshot())

    class State:
        game_id="3288084282"
        round=None
        player=None
        board=[]
        augments=[]

    package_path=recorder.finalize(State())
    assert package_path is not None
    import gzip, json
    with gzip.open(package_path,"rt",encoding="utf-8") as source:
        payload=json.load(source)
    assert payload["session"]["gameId"]=="BR1_3288084282"
