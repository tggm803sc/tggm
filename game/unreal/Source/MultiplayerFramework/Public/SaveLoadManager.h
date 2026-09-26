#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "MultiplayerSaveGame.h"
#include "SaveLoadManager.generated.h"

UCLASS()
class MULTIPLAYERFRAMEWORK_API ASaveLoadManager : public AActor
{
    GENERATED_BODY()

public:
    ASaveLoadManager();

    UFUNCTION(BlueprintCallable, Category="TGG|Save")
    bool SavePlayerSnapshot(const FPlayerPersistentSnapshot& Snapshot);

    UFUNCTION(BlueprintCallable, Category="TGG|Save")
    bool LoadPlayerSnapshot(const FString& PlayerId, FPlayerPersistentSnapshot& OutSnapshot) const;

protected:
    UPROPERTY(EditDefaultsOnly, Category="TGG|Save")
    FString SlotName = TEXT("TGG_Server_Save");

    UPROPERTY(EditDefaultsOnly, Category="TGG|Save")
    int32 UserIndex = 0;

private:
    UMultiplayerSaveGame* LoadOrCreate() const;
};
