#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "SpeedHackValidator.generated.h"

UCLASS(ClassGroup=(TGG), meta=(BlueprintSpawnableComponent))
class MULTIPLAYERFRAMEWORK_API USpeedHackValidator : public UActorComponent
{
    GENERATED_BODY()

public:
    USpeedHackValidator();

    UFUNCTION(BlueprintCallable, Category="TGG|AntiCheat")
    bool ValidateMovementSample(FVector_NetQuantize Location, double ClientTimestamp);

    UFUNCTION(BlueprintPure, Category="TGG|AntiCheat")
    int32 GetViolationCount() const { return ViolationCount; }

protected:
    UPROPERTY(EditDefaultsOnly, Category="TGG|AntiCheat", meta=(ClampMin="0.0"))
    float MaxSpeedUnitsPerSecond = 1400.0f;

    UPROPERTY(EditDefaultsOnly, Category="TGG|AntiCheat", meta=(ClampMin="0.0"))
    float DistanceSlack = 200.0f;

    UPROPERTY(EditDefaultsOnly, Category="TGG|AntiCheat", meta=(ClampMin="0.0"))
    float MaxTimestampLeadSeconds = 0.25f;

    UPROPERTY(Replicated)
    int32 ViolationCount = 0;

    FVector LastLocation = FVector::ZeroVector;
    double LastServerTime = 0.0;
    bool bHasBaseline = false;

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};
