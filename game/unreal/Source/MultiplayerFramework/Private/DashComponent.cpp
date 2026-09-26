#include "DashComponent.h"

#include "GameFramework/Character.h"
#include "Net/UnrealNetwork.h"

UDashComponent::UDashComponent()
{
    SetIsReplicatedByDefault(true);
    PrimaryComponentTick.bCanEverTick = false;
}

void UDashComponent::RequestDash(const FVector& Direction)
{
    const FVector SafeDirection = Direction.GetClampedToMaxSize(MaxDirectionMagnitude).GetSafeNormal();
    if (SafeDirection.IsNearlyZero())
    {
        return;
    }

    AActor* Owner = GetOwner();
    if (!Owner)
    {
        return;
    }

    if (Owner->HasAuthority())
    {
        if (CanDashNow())
        {
            ExecuteDash(SafeDirection);
        }
        return;
    }

    ServerRequestDash(SafeDirection);
}

void UDashComponent::ServerRequestDash_Implementation(const FVector_NetQuantizeNormal Direction)
{
    if (!CanDashNow())
    {
        return;
    }

    const FVector SafeDirection = FVector(Direction).GetSafeNormal();
    if (SafeDirection.IsNearlyZero())
    {
        return;
    }

    ExecuteDash(SafeDirection);
}

bool UDashComponent::CanDashNow() const
{
    const UWorld* World = GetWorld();
    return World && (World->GetTimeSeconds() - LastAuthoritativeDashTime) >= DashCooldownSeconds;
}

void UDashComponent::ExecuteDash(const FVector& Direction)
{
    ACharacter* Character = Cast<ACharacter>(GetOwner());
    if (!Character || !Character->HasAuthority())
    {
        return;
    }

    LastAuthoritativeDashTime = GetWorld()->GetTimeSeconds();
    Character->LaunchCharacter(Direction * DashStrength, true, false);
}

void UDashComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME_CONDITION(UDashComponent, LastAuthoritativeDashTime, COND_OwnerOnly);
}
