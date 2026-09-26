#include "SaveLoadManager.h"

#include "Kismet/GameplayStatics.h"

ASaveLoadManager::ASaveLoadManager()
{
    PrimaryActorTick.bCanEverTick = false;
    bReplicates = false;
}

UMultiplayerSaveGame* ASaveLoadManager::LoadOrCreate() const
{
    if (USaveGame* Existing = UGameplayStatics::LoadGameFromSlot(SlotName, UserIndex))
    {
        if (UMultiplayerSaveGame* Typed = Cast<UMultiplayerSaveGame>(Existing))
        {
            return Typed;
        }
    }

    return Cast<UMultiplayerSaveGame>(UGameplayStatics::CreateSaveGameObject(UMultiplayerSaveGame::StaticClass()));
}

bool ASaveLoadManager::SavePlayerSnapshot(const FPlayerPersistentSnapshot& Snapshot)
{
    if (!HasAuthority() || Snapshot.PlayerId.IsEmpty())
    {
        return false;
    }

    UMultiplayerSaveGame* Save = LoadOrCreate();
    if (!Save)
    {
        return false;
    }

    Save->Players.RemoveAll([&Snapshot](const FPlayerPersistentSnapshot& Existing)
    {
        return Existing.PlayerId == Snapshot.PlayerId;
    });
    Save->Players.Add(Snapshot);

    return UGameplayStatics::SaveGameToSlot(Save, SlotName, UserIndex);
}

bool ASaveLoadManager::LoadPlayerSnapshot(const FString& PlayerId, FPlayerPersistentSnapshot& OutSnapshot) const
{
    if (PlayerId.IsEmpty())
    {
        return false;
    }

    if (UMultiplayerSaveGame* Save = LoadOrCreate())
    {
        for (const FPlayerPersistentSnapshot& Snapshot : Save->Players)
        {
            if (Snapshot.PlayerId == PlayerId)
            {
                OutSnapshot = Snapshot;
                return true;
            }
        }
    }

    return false;
}
