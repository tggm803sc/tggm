#include "CombatComponent.h"

#include "Engine/World.h"
#include "PlayerCharacter.h"

UCombatComponent::UCombatComponent()
{
    SetIsReplicatedByDefault(true);
    PrimaryComponentTick.bCanEverTick = false;
}

void UCombatComponent::RequestServerShot(const FVector_NetQuantize Origin, const FVector_NetQuantizeNormal Direction)
{
    AActor* Owner = GetOwner();
    if (!Owner)
    {
        return;
    }

    if (Owner->HasAuthority())
    {
        ServerShot_Implementation(Origin, Direction);
    }
    else
    {
        ServerShot(Origin, Direction);
    }
}

bool UCombatComponent::ValidateShot(const FVector& Origin, const FVector& Direction) const
{
    const AActor* Owner = GetOwner();
    if (!Owner || Direction.IsNearlyZero())
    {
        return false;
    }

    return FVector::DistSquared(Origin, Owner->GetActorLocation()) <= FMath::Square(MaxOriginError);
}

void UCombatComponent::ServerShot_Implementation(const FVector_NetQuantize Origin, const FVector_NetQuantizeNormal Direction)
{
    AActor* Owner = GetOwner();
    if (!Owner || !Owner->HasAuthority() || !ValidateShot(Origin, Direction))
    {
        return;
    }

    FHitResult Hit;
    FCollisionQueryParams Params(SCENE_QUERY_STAT(TGGServerShot), false, Owner);
    const FVector End = FVector(Origin) + FVector(Direction).GetSafeNormal() * MaxRange;

    if (GetWorld()->LineTraceSingleByChannel(Hit, Origin, End, ECC_Visibility, Params))
    {
        if (APlayerCharacter* Target = Cast<APlayerCharacter>(Hit.GetActor()))
        {
            Target->ApplyServerDamage(Damage);
        }
    }
}
