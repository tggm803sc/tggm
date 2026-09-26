#include "AbilitySystemComponent.h"

#include "Net/UnrealNetwork.h"

UAbilitySystemComponent::UAbilitySystemComponent()
{
    SetIsReplicatedByDefault(true);
    PrimaryComponentTick.bCanEverTick = false;
}

bool UAbilitySystemComponent::TryActivateAbility(const FName AbilityId, const float CooldownSeconds)
{
    AActor* Owner = GetOwner();
    UWorld* World = GetWorld();
    if (!Owner || !Owner->HasAuthority() || !World || AbilityId.IsNone() || CooldownSeconds < 0.0f)
    {
        return false;
    }

    const double Now = World->GetTimeSeconds();
    FAbilityCooldownEntry* Existing = Cooldowns.FindByPredicate([AbilityId](const FAbilityCooldownEntry& Entry)
    {
        return Entry.AbilityId == AbilityId;
    });

    if (Existing && Existing->ReadyAtServerTime > Now)
    {
        return false;
    }

    if (!Existing)
    {
        Existing = &Cooldowns.AddDefaulted_GetRef();
        Existing->AbilityId = AbilityId;
    }

    Existing->ReadyAtServerTime = Now + CooldownSeconds;
    return true;
}

float UAbilitySystemComponent::GetRemainingCooldown(const FName AbilityId) const
{
    const UWorld* World = GetWorld();
    if (!World)
    {
        return 0.0f;
    }

    if (const FAbilityCooldownEntry* Existing = Cooldowns.FindByPredicate([AbilityId](const FAbilityCooldownEntry& Entry)
    {
        return Entry.AbilityId == AbilityId;
    }))
    {
        return FMath::Max(0.0, Existing->ReadyAtServerTime - World->GetTimeSeconds());
    }

    return 0.0f;
}

void UAbilitySystemComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME_CONDITION(UAbilitySystemComponent, Cooldowns, COND_OwnerOnly);
}
