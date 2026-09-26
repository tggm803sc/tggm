#pragma once

#include "CoreMinimal.h"
#include "GameFramework/SaveGame.h"
#include "MultiplayerSaveGame.generated.h"

USTRUCT(BlueprintType)
struct FPlayerPersistentSnapshot
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FString PlayerId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Currency = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 Experience = 0;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<FName> InventoryItemIds;
};

UCLASS()
class MULTIPLAYERFRAMEWORK_API UMultiplayerSaveGame : public USaveGame
{
    GENERATED_BODY()

public:
    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    int32 SchemaVersion = 1;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    TArray<FPlayerPersistentSnapshot> Players;
};
