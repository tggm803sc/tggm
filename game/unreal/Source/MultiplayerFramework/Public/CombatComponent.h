#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "CombatComponent.generated.h"

UCLASS(ClassGroup=(TGG), meta=(BlueprintSpawnableComponent))
class MULTIPLAYERFRAMEWORK_API UCombatComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UCombatComponent();

    UFUNCTION(BlueprintCallable, Category="TGG|Combat")
    void RequestServerShot(FVector_NetQuantize Origin, FVector_NetQuantizeNormal Direction);

protected:
    UPROPERTY(EditDefaultsOnly, Category="TGG|Combat", meta=(ClampMin="1.0"))
    float MaxRange = 10000.0f;

    UPROPERTY(EditDefaultsOnly, Category="TGG|Combat", meta=(ClampMin="0.0"))
    float Damage = 25.0f;

    UPROPERTY(EditDefaultsOnly, Category="TGG|Combat", meta=(ClampMin="0.0"))
    float MaxOriginError = 250.0f;

    UFUNCTION(Server, Reliable)
    void ServerShot(FVector_NetQuantize Origin, FVector_NetQuantizeNormal Direction);

    bool ValidateShot(const FVector& Origin, const FVector& Direction) const;
};
