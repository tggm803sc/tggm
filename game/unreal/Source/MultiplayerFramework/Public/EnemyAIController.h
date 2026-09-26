#pragma once

#include "CoreMinimal.h"
#include "AIController.h"
#include "EnemyAIController.generated.h"

UCLASS()
class MULTIPLAYERFRAMEWORK_API AEnemyAIController : public AAIController
{
    GENERATED_BODY()

public:
    AEnemyAIController();

    UFUNCTION(BlueprintCallable, Category="TGG|AI")
    void SetCombatTarget(AActor* NewTarget);

    UFUNCTION(BlueprintPure, Category="TGG|AI")
    AActor* GetCombatTarget() const { return CombatTarget.Get(); }

protected:
    UPROPERTY()
    TWeakObjectPtr<AActor> CombatTarget;

    UPROPERTY(EditDefaultsOnly, Category="TGG|AI", meta=(ClampMin="0.0"))
    float AcceptanceRadius = 125.0f;
};
