#include "PlayerCharacter.h"

#include "Net/UnrealNetwork.h"

APlayerCharacter::APlayerCharacter()
{
    bReplicates = true;
    SetReplicateMovement(true);
    NetUpdateFrequency = 60.0f;
    MinNetUpdateFrequency = 20.0f;
}

void APlayerCharacter::BeginPlay()
{
    Super::BeginPlay();

    if (HasAuthority())
    {
        Health = MaxHealth;
    }
}

void APlayerCharacter::ApplyServerDamage(const float Amount)
{
    if (!HasAuthority() || Amount <= 0.0f || Health <= 0.0f)
    {
        return;
    }

    const float Previous = Health;
    Health = FMath::Clamp(Health - Amount, 0.0f, MaxHealth);
    BP_OnHealthChanged(Previous, Health);
}

void APlayerCharacter::OnRep_Health(const float PreviousHealth)
{
    BP_OnHealthChanged(PreviousHealth, Health);
}

void APlayerCharacter::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(APlayerCharacter, Health);
}
