#include "MatchmakingEloComponent.h"

#include "Net/UnrealNetwork.h"

UMatchmakingEloComponent::UMatchmakingEloComponent()
{
    SetIsReplicatedByDefault(true);
    PrimaryComponentTick.bCanEverTick = false;
}

void UMatchmakingEloComponent::ServerRecordResult(const float OpponentRating, const float Score)
{
    AActor* Owner = GetOwner();
    if (!Owner || !Owner->HasAuthority())
    {
        return;
    }

    const float ClampedScore = FMath::Clamp(Score, 0.0f, 1.0f);
    const float Expected = 1.0f / (1.0f + FMath::Pow(10.0f, (OpponentRating - Rating) / 400.0f));
    const float Previous = Rating;
    Rating = FMath::Max(0.0f, Rating + KFactor * (ClampedScore - Expected));
    BP_OnRatingChanged(Previous, Rating);
}

void UMatchmakingEloComponent::OnRep_Rating(const float PreviousRating)
{
    BP_OnRatingChanged(PreviousRating, Rating);
}

void UMatchmakingEloComponent::GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const
{
    Super::GetLifetimeReplicatedProps(OutLifetimeProps);
    DOREPLIFETIME_CONDITION(UMatchmakingEloComponent, Rating, COND_OwnerOnly);
}
