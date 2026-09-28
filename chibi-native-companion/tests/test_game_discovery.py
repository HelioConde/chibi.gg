from types import SimpleNamespace
from chibi.riot.game.localhost import localhost_services
from chibi.riot.game.process import RiotProcess, discover_processes, is_riot_process

def test_filters_only_riot_processes():
    items = [{"pid": 1, "name": "LeagueClient.exe", "exe": "C:/Riot/LeagueClient.exe", "create_time": 1}, {"pid": 2, "name": "notepad.exe", "exe": "C:/Windows/notepad.exe", "create_time": 1}]
    assert [item.pid for item in discover_processes(items)] == [1]
    assert is_riot_process("RiotClientServices.exe")
    assert not is_riot_process("VALORANT-Win64-Shipping.exe", "C:/Riot Games/VALORANT/live/game.exe")

def test_filters_localhost_to_known_riot_pids():
    process = RiotProcess(10, "LeagueClient.exe", "", "")
    connections = [SimpleNamespace(pid=10, laddr=("127.0.0.1", 1234), status="LISTEN"), SimpleNamespace(pid=99, laddr=("127.0.0.1", 9999), status="LISTEN"), SimpleNamespace(pid=10, laddr=("0.0.0.0", 80), status="LISTEN")]
    assert [item.local_port for item in localhost_services([process], connections)] == [1234]
