#include "TrapPoolManager.h"

#include "Engine/World.h"
#include "SpikeTrap.h"

ATrapPoolManager::ATrapPoolManager()
{
    PrimaryActorTick.bCanEverTick = false;
    bReplicates = false;
}

void ATrapPoolManager::BeginPlay()
{
    Super::BeginPlay();

    if (!HasAuthority() || !TrapClass)
    {
        return;
    }

    Pool.Reserve(PrewarmCount);
    for (int32 Index = 0; Index < PrewarmCount; ++Index)
    {
        SpawnPooledTrap();
    }
}

ASpikeTrap* ATrapPoolManager::SpawnPooledTrap()
{
    if (!HasAuthority() || !TrapClass)
    {
        return nullptr;
    }

    ASpikeTrap* Trap = GetWorld()->SpawnActorDeferred<ASpikeTrap>(
        TrapClass,
        FTransform::Identity,
        this,
        nullptr,
        ESpawnActorCollisionHandlingMethod::AlwaysSpawn);

    if (!Trap)
    {
        return nullptr;
    }

    Trap->FinishSpawning(FTransform::Identity);
    Trap->DeactivateTrap();
    Pool.Add(Trap);
    return Trap;
}

ASpikeTrap* ATrapPoolManager::AcquireTrap(const FTransform& SpawnTransform)
{
    if (!HasAuthority())
    {
        return nullptr;
    }

    for (ASpikeTrap* Trap : Pool)
    {
        if (IsValid(Trap) && !Trap->IsTrapActive())
        {
            Trap->ActivateTrap(SpawnTransform);
            return Trap;
        }
    }

    ASpikeTrap* Trap = SpawnPooledTrap();
    if (Trap)
    {
        Trap->ActivateTrap(SpawnTransform);
    }
    return Trap;
}

void ATrapPoolManager::ReleaseTrap(ASpikeTrap* Trap)
{
    if (HasAuthority() && IsValid(Trap) && Pool.Contains(Trap))
    {
        Trap->DeactivateTrap();
    }
}
