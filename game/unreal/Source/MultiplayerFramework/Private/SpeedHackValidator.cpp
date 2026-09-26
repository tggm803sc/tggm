#include "SpeedHackValidator.h"

#include "Net/UnrealNetwork.h"

USpeedHackValidator::USpeedHackValidator()
{
    SetIsReplicatedByDefault(true);
    PrimaryComponentTick.bCanEverTick = false;
}

bool USpeedHackValidator::ValidateMovementSample(const FVector_NetQuantize Location, const double ClientTimestamp)
{
    AActor* Owner = GetOwner();
    UWorld* World = GetWorld();
    if (!Owner || !Owner->HasAuthority() || !World)
    {
        return false;
    }

    const double Now = World->GetTimeSeconds();
    if (ClientTimestamp > Now + MaxTimestampLeadSeconds)
    {
        ++ViolationCount;
        return false;
    }

    if (!bHasBaseline)
    {
        LastLocation = Location;
        LastServerTime = Now;
        bHasBaseline = true;
        return true;
    }

    const double DeltaSeconds = FMath::Max(0.001, Now - LastServerTime);
    const double AllowedDistance = MaxSpeedUnitsPerSecond * DeltaSeconds + DistanceSlack;
    const double ActualDistance = FVector::Distance(LastLocation, FVector(Location));

    LastLocation = Location;
    LastServerTime = Now;

    if (ActualDistance > AllowedDistance)
    {
        ++ViolationCount;
        return false;
    }

    return true;
}

void USpeedHackValidator::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME_CONDITION(USpeedHackValidator, ViolationCount, COND_OwnerOnly);
}
