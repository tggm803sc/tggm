#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "AbilitySystemComponent.generated.h"

USTRUCT(BlueprintType)
struct FAbilityCooldownEntry
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    FName AbilityId;

    UPROPERTY(EditAnywhere, BlueprintReadOnly)
    double ReadyAtServerTime = 0.0;
};

UCLASS(ClassGroup=(TGG), meta=(BlueprintSpawnableComponent))
class MULTIPLAYERFRAMEWORK_API UAbilitySystemComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UAbilitySystemComponent();

    UFUNCTION(BlueprintCallable, Category="TGG|Ability")
    bool TryActivateAbility(FName AbilityId, float CooldownSeconds);

    UFUNCTION(BlueprintPure, Category="TGG|Ability")
    float GetRemainingCooldown(FName AbilityId) const;

protected:
    UPROPERTY(Replicated)
    TArray<FAbilityCooldownEntry> Cooldowns;

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};
