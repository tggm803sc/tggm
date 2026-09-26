#include "WeaponCombatComponent.h"

#include "Net/UnrealNetwork.h"

UWeaponCombatComponent::UWeaponCombatComponent()
{
    SetIsReplicatedByDefault(true);
    PrimaryComponentTick.bCanEverTick = false;
}

bool UWeaponCombatComponent::RequestFire()
{
    AActor* Owner = GetOwner();
    if (!Owner)
    {
        return false;
    }

    if (Owner->HasAuthority())
    {
        return ConsumeAmmoServer();
    }

    ServerRequestFire();
    return CurrentAmmo > 0;
}

void UWeaponCombatComponent::ServerRequestFire_Implementation()
{
    ConsumeAmmoServer();
}

bool UWeaponCombatComponent::CanFireServer() const
{
    const UWorld* World = GetWorld();
    return World
        && CurrentAmmo > 0
        && (World->GetTimeSeconds() - LastServerFireTime) >= FireIntervalSeconds;
}

bool UWeaponCombatComponent::ConsumeAmmoServer()
{
    AActor* Owner = GetOwner();
    if (!Owner || !Owner->HasAuthority() || !CanFireServer())
    {
        return false;
    }

    const int32 Previous = CurrentAmmo;
    --CurrentAmmo;
    LastServerFireTime = GetWorld()->GetTimeSeconds();
    BP_OnAmmoChanged(Previous, CurrentAmmo);
    return true;
}

void UWeaponCombatComponent::ServerGrantAmmo(const int32 Amount)
{
    AActor* Owner = GetOwner();
    if (!Owner || !Owner->HasAuthority() || Amount <= 0)
    {
        return;
    }

    const int32 Previous = CurrentAmmo;
    CurrentAmmo = FMath::Clamp(CurrentAmmo + Amount, 0, MaxAmmo);
    BP_OnAmmoChanged(Previous, CurrentAmmo);
}

void UWeaponCombatComponent::OnRep_Ammo(const int32 PreviousAmmo)
{
    BP_OnAmmoChanged(PreviousAmmo, CurrentAmmo);
}

void UWeaponCombatComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(UWeaponCombatComponent, CurrentAmmo);
}
