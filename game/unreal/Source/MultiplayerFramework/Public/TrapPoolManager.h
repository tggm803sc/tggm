#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "TrapPoolManager.generated.h"

class ASpikeTrap;

UCLASS()
class MULTIPLAYERFRAMEWORK_API ATrapPoolManager : public AActor
{
    GENERATED_BODY()

public:
    ATrapPoolManager();

    UFUNCTION(BlueprintCallable, Category="TGG|TrapPool")
    ASpikeTrap* AcquireTrap(const FTransform& SpawnTransform);

    UFUNCTION(BlueprintCallable, Category="TGG|TrapPool")
    void ReleaseTrap(ASpikeTrap* Trap);

protected:
    virtual void BeginPlay() override;

    UPROPERTY(EditDefaultsOnly, Category="TGG|TrapPool")
    TSubclassOf<ASpikeTrap> TrapClass;

    UPROPERTY(EditDefaultsOnly, Category="TGG|TrapPool", meta=(ClampMin="0"))
    int32 PrewarmCount = 64;

    UPROPERTY(Transient)
    TArray<TObjectPtr<ASpikeTrap>> Pool;

private:
    ASpikeTrap* SpawnPooledTrap();
};
