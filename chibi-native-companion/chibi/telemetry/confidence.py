from enum import Enum

class DataConfidence(str, Enum):
    VERIFIED = "verified"
    OBSERVED = "observed"
    UNVERIFIED = "unverified"
    UNAVAILABLE = "unavailable"
