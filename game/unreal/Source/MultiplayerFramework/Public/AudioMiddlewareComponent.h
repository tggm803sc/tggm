#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "AudioMiddlewareComponent.generated.h"

USTRUCT(BlueprintType)
struct FAcousticZoneState
{
    GENERATED_BODY()

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    FName ZoneId;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float ReverbSend = 0.0f;

    UPROPERTY(EditAnywhere, BlueprintReadWrite)
    float Occlusion = 0.0f;
};

UCLASS(ClassGroup=(TGG), meta=(BlueprintSpawnableComponent))
class MULTIPLAYERFRAMEWORK_API UAudioMiddlewareComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UAudioMiddlewareComponent();

    UFUNCTION(BlueprintCallable, Category="TGG|Audio")
    void SetAcousticState(const FAcousticZoneState& NewState);

    UFUNCTION(BlueprintPure, Category="TGG|Audio")
    FAcousticZoneState GetAcousticState() const { return State; }

protected:
    UPROPERTY(ReplicatedUsing=OnRep_State)
    FAcousticZoneState State;

    UFUNCTION()
    void OnRep_State();

    UFUNCTION(BlueprintImplementableEvent, Category="TGG|Audio")
    void BP_ApplyAcousticState(const FAcousticZoneState& NewState);

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};
