#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "MatchmakingEloComponent.generated.h"

UCLASS(ClassGroup=(TGG), meta=(BlueprintSpawnableComponent))
class MULTIPLAYERFRAMEWORK_API UMatchmakingEloComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UMatchmakingEloComponent();

    UFUNCTION(BlueprintCallable, Category="TGG|Matchmaking")
    void ServerRecordResult(float OpponentRating, float Score);

    UFUNCTION(BlueprintPure, Category="TGG|Matchmaking")
    float GetRating() const { return Rating; }

protected:
    UPROPERTY(ReplicatedUsing=OnRep_Rating)
    float Rating = 1000.0f;

    UPROPERTY(EditDefaultsOnly, Category="TGG|Matchmaking", meta=(ClampMin="1.0"))
    float KFactor = 32.0f;

    UFUNCTION()
    void OnRep_Rating(float PreviousRating);

    UFUNCTION(BlueprintImplementableEvent, Category="TGG|Matchmaking")
    void BP_OnRatingChanged(float PreviousRating, float NewRating);

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};
