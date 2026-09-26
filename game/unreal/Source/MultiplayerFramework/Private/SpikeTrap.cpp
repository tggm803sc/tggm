#include "SpikeTrap.h"

#include "Components/BoxComponent.h"
#include "Components/StaticMeshComponent.h"
#include "GameFramework/Character.h"
#include "Net/UnrealNetwork.h"
#include "PlayerCharacter.h"
#include "TimerManager.h"

ASpikeTrap::ASpikeTrap()
{
    bReplicates = true;
    SetReplicateMovement(false);

    Mesh = CreateDefaultSubobject<UStaticMeshComponent>(TEXT("Mesh"));
    SetRootComponent(Mesh);
    Mesh->SetCollisionEnabled(ECollisionEnabled::NoCollision);

    Trigger = CreateDefaultSubobject<UBoxComponent>(TEXT("Trigger"));
    Trigger->SetupAttachment(Mesh);
    Trigger->SetGenerateOverlapEvents(true);
    Trigger->OnComponentBeginOverlap.AddDynamic(this, &ASpikeTrap::HandleOverlap);

    SetActorHiddenInGame(true);
    SetActorEnableCollision(false);
}

void ASpikeTrap::ActivateTrap(const FTransform& SpawnTransform)
{
    if (!HasAuthority())
    {
        return;
    }

    SetActorTransform(SpawnTransform, false, nullptr, ETeleportType::TeleportPhysics);
    bTrapActive = true;
    SetActorHiddenInGame(false);
    RefreshCollisionState();
    ForceNetUpdate();
}

void ASpikeTrap::DeactivateTrap()
{
    if (!HasAuthority())
    {
        return;
    }

    bTrapActive = false;
    GetWorldTimerManager().ClearTimer(ReactivationTimer);
    SetActorHiddenInGame(true);
    RefreshCollisionState();
    ForceNetUpdate();
}

void ASpikeTrap::HandleOverlap(UPrimitiveComponent*, AActor* OtherActor, UPrimitiveComponent*, int32, bool, const FHitResult&)
{
    if (!HasAuthority() || !bTrapActive || !IsValid(OtherActor))
    {
        return;
    }

    if (APlayerCharacter* Player = Cast<APlayerCharacter>(OtherActor))
    {
        Player->ApplyServerDamage(Damage);
        bTrapActive = false;
        RefreshCollisionState();

        GetWorldTimerManager().SetTimer(
            ReactivationTimer,
            FTimerDelegate::CreateWeakLambda(this, [this]()
            {
                if (HasAuthority() && !IsActorBeingDestroyed())
                {
                    bTrapActive = true;
                    RefreshCollisionState();
                    ForceNetUpdate();
                }
            }),
            ReactivationDelay,
            false);
    }
}

void ASpikeTrap::OnRep_TrapActive()
{
    SetActorHiddenInGame(!bTrapActive);
    RefreshCollisionState();
}

void ASpikeTrap::RefreshCollisionState()
{
    SetActorEnableCollision(bTrapActive);
    Trigger->SetCollisionEnabled(bTrapActive ? ECollisionEnabled::QueryOnly : ECollisionEnabled::NoCollision);
}

void ASpikeTrap::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME(ASpikeTrap, bTrapActive);
}
