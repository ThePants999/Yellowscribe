local AGENDA_MANAGER_TAG_PATTERN = "am:(.+)"
local crusadeCardData = {
    toggles = {
        ccBlooded = false,
        ccBattleHardened = false,
        ccHeroic = false,
        ccLegendary = false
    },
    fields = {
        ccUnitName = "",
        ccBattlefieldRole = "",
        ccCrusadeFaction = "",
        ccSelectableKeywords = "",
        ccUnitType = "",
        ccEquipment = "",
        ccPsychicPowers = "",
        ccWarlordTrait = "",
        ccRelic = "",
        ccOtherUpgrades = "",
        ccBattleHonors = "",
        ccBattleScars = ""
    },
    counters= {
        pl = 0, 
        xp = 0, 
        cl = 0, 
        totalKills = 0, 
        played = 0, 
        survived = 0
    }
}