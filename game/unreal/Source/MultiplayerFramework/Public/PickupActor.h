#pragma once

#include "CoreMinimal.h"
#include "GameFramework/Actor.h"
#include "PickupActor.generated.h"

class USphereComponent;
class UStaticMeshComponent;

UCLASS()
class MULTIPLAYERFRAMEWORK_API APickupActor : public AActor
{
    GENERATED_BODY()

public:
    APickupActor();

protected:
    UPROPERTY(VisibleAnywhere)
    TObjectPtr<UStaticMeshComponent> Mesh;

    UPROPERTY(VisibleAnywhere)
    TObjectPtr<USphereComponent> Trigger;

    UPROPERTY(EditAnywhere, Category="TGG|Pickup")
    FName ItemId;

    UPROPERTY(EditAnywhere, Category="TGG|Pickup", meta=(ClampMin="1"))
    int32 Quantity = 1;

    UFUNCTION()
    void HandleOverlap(UPrimitiveComponent* OverlappedComponent, AActor* OtherActor, UPrimitiveComponent* OtherComp,
        int32 OtherBodyIndex, bool bFromSweep, const FHitResult& SweepResult);
};
