use serde::{Deserialize, Deserializer, Serialize, Serializer};
use std::{convert::TryInto, str::FromStr};

/// Transaction hash.
/// Essentially, a SHA-256 hash of transaction bytes encoded according to the zkSync protocol.
#[derive(Debug, Copy, Clone, PartialEq, Default, Eq, Hash, PartialOrd, Ord)]
pub struct TxHash {
    pub(crate) data: [u8; 32],
}

impl TxHash {
    /// Reads a transaction hash from its byte sequence representation.
    ///
    /// Returns none if the slice length does not match with hash length.
    pub fn from_slice(slice: &[u8]) -> Option<Self> {
        let mut out = TxHash { data: [0_u8; 32] };

        if slice.len() != out.data.len() {
            None
        } else {
            out.data.copy_from_slice(slice);
            Some(out)
        }
    }
}

impl AsRef<[u8]> for TxHash {
    fn as_ref(&self) -> &[u8] {
        &self.data
    }
}

impl ToString for TxHash {
    fn to_string(&self) -> String {
        format!("sync-tx:{}", hex::encode(&self.data))
    }
}

impl FromStr for TxHash {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        anyhow::ensure!(
            s.starts_with("sync-tx:"),
            "TxHash should start with sync-tx:"
        );
        let bytes = hex::decode(&s[8..])?;
        anyhow::ensure!(bytes.len() == 32, "Size mismatch");
        Ok(TxHash {
            data: bytes.as_slice().try_into().unwrap(),
        })
    }
}

impl Serialize for TxHash {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        serializer.serialize_str(&self.to_string())
    }
}

impl<'de> Deserialize<'de> for TxHash {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let string = String::deserialize(deserializer)?;
        Self::from_str(&string).map_err(serde::de::Error::custom)
    }
}
