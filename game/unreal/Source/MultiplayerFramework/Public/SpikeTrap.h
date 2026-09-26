#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "SpikeTrap.generated.h"

class UBoxComponent;
class UStaticMeshComponent;

UCLASS()
class MULTIPLAYERFRAMEWORK_API ASpikeTrap : public AActor
{
    GENERATED_BODY()

public:
    ASpikeTrap();

    UFUNCTION(BlueprintCallable, Category="TGG|Trap")
    void ActivateTrap(const FTransform& SpawnTransform);

    UFUNCTION(BlueprintCallable, Category="TGG|Trap")
    void DeactivateTrap();

    UFUNCTION(BlueprintPure, Category="TGG|Trap")
    bool IsTrapActive() const { return bTrapActive; }

protected:
    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="TGG|Trap")
    TObjectPtr<UStaticMeshComponent> Mesh;

    UPROPERTY(VisibleAnywhere, BlueprintReadOnly, Category="TGG|Trap")
    TObjectPtr<UBoxComponent> Trigger;

    UPROPERTY(EditDefaultsOnly, Category="TGG|Trap", meta=(ClampMin="0.0"))
    float Damage = 25.0f;

    UPROPERTY(EditDefaultsOnly, Category="TGG|Trap", meta=(ClampMin="0.05"))
    float ReactivationDelay = 1.0f;

    UPROPERTY(ReplicatedUsing=OnRep_TrapActive)
    bool bTrapActive = false;

    FTimerHandle ReactivationTimer;

    UFUNCTION()
    void HandleOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp,
        int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult);

    UFUNCTION()
    void OnRep_TrapActive();

    void RefreshCollisionState();

    virtual void GetLifetimeReplicatedProps(TArray<FLifetimeProperty>& OutLifetimeProps) const override;
};
