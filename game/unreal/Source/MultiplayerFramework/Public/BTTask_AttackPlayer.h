#pragma once

#include "CoreMinimal.h"
#include "BehaviorTree/BTTaskNode.h"
#include "BTTask_AttackPlayer.generated.h"

UCLASS()
class MULTIPLAYERFRAMEWORK_API UBTTask_AttackPlayer : public UBTTaskNode
{
    GENERATED_BODY()

public:
    UBTTask_AttackPlayer();

protected:
    virtual EBTNodeResult::Type ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8* NodeMemory) override;

    UPROPERTY(EditAnywhere, Category="TGG|AI", meta=(ClampMin="0.0"))
    float AttackDamage = 10.0f;

    UPROPERTY(EditAnywhere, Category="TGG|AI", meta=(ClampMin="0.0"))
    float AttackRange = 200.0f;
};
