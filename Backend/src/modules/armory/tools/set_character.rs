use crate::dto::Failure;
use crate::modules::armory::Armory;
use crate::modules::armory::dto::CharacterDto;
use crate::modules::armory::material::Character;
use crate::modules::armory::tools::{CreateCharacter, GetCharacter, SetCharacterHistory};

pub trait SetCharacter {
  fn set_character(&self, server_id: u32, update_character: CharacterDto) -> Result<Character, Failure>;
}

impl SetCharacter for Armory {
  fn set_character(&self, server_id: u32, update_character: CharacterDto) -> Result<Character, Failure> {
    // Validation
    if update_character.server_uid == 0 {
      return Err(Failure::InvalidInput);
    }

    // Exists the character ? get char : create char
    let character_id_res = self.get_character_id_by_uid(server_id, update_character.server_uid)
      .or_else(|| self.create_character(server_id, update_character.server_uid).ok());
    if character_id_res.is_none() {
      return Err(Failure::Unknown);
    }
    let character_id = character_id_res.unwrap();

    // Set the character history
    if update_character.character_history.is_some() {
      let character_history_res = self.set_character_history(server_id, update_character.character_history.unwrap());
      if character_history_res.is_err() {
        return Err(character_history_res.err().unwrap());
      }
    }

    self.get_character(character_id).ok_or(Failure::Unknown)
  }
}