#pragma once

#include "CoreMinimal.h"
#include "Components/ActorComponent.h"
#include "DashComponent.generated.h"

UCLASS(ClassGroup=(TGG), meta=(BlueprintSpawnableComponent))
class MULTIPLAYERFRAMEWORK_API UDashComponent : public UActorComponent
{
    GENERATED_BODY()

public:
    UDashComponent();

    UFUNCTION(BlueprintCallable, Category="TGG|Movement")
    void RequestDash(const FVector& Direction);

protected:
    UPROPERTY(EditDefaultsOnly, Category="TGG|Movement", meta=(ClampMin="0.0"))
    float DashStrength = 1200.0f;

    UPROPERTY(EditDefaultsOnly, Category="TGG|Movement", meta=(ClampMin="0.0"))
    float DashCooldownSeconds = 0.75f;

    UPROPERTY(EditDefaultsOnly, Category="TGG|Movement", meta=(ClampMin="0.0"))
    float MaxDirectionMagnitude = 1.05f;

    UPROPERTY(Replicated)
    double LastAuthoritativeDashTime = -1000.0;

    UFUNCTION(Server, Reliable)
    void ServerRequestDash(FVector_NetQuantizeNormal Direction);

    bool CanDashNow() const;
    void ExecuteDash(const FVector& Direction);

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};
