from chibi.telemetry.confidence import DataConfidence
from chibi.telemetry.manager import TelemetryManager
from chibi.telemetry.models import LiveField, TelemetrySnapshot

class Observed:
    name = "observed"
    def available(self): return True
    def poll(self): return TelemetrySnapshot(gold=LiveField(42, self.name, DataConfidence.OBSERVED, 1, False))

class Verified:
    name = "verified"
    def available(self): return True
    def poll(self): return TelemetrySnapshot(gold=LiveField(42, self.name, DataConfidence.VERIFIED, 1, False))

def test_only_verified_telemetry_is_selected():
    assert TelemetryManager([Observed()]).poll().gold.confidence is DataConfidence.UNAVAILABLE
    assert TelemetryManager([Observed(), Verified()]).poll().gold.source == "verified"
