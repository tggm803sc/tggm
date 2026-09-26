#include "BTTask_AttackPlayer.h"

#include "BehaviorTree/BehaviorTreeComponent.h"
#include "EnemyAIController.h"
#include "GameFramework/Pawn.h"
#include "PlayerCharacter.h"

UBTTask_AttackPlayer::UBTTask_AttackPlayer()
{
    NodeName = TEXT("TGG Attack Player");
}

EBTNodeResult::Type UBTTask_AttackPlayer::ExecuteTask(UBehaviorTreeComponent& OwnerComp, uint8*)
{
    AEnemyAIController* Controller = Cast<AEnemyAIController>(OwnerComp.GetAIOwner());
    APawn* Pawn = Controller ? Controller->GetPawn() : nullptr;
    APlayerCharacter* Target = Controller ? Cast<APlayerCharacter>(Controller->GetCombatTarget()) : nullptr;

    if (!Controller || !Pawn || !Target || !Controller->HasAuthority())
    {
        return EBTNodeResult::Failed;
    }

    if (FVector::DistSquared(Pawn->GetActorLocation(), Target->GetActorLocation()) > FMath::Square(AttackRange))
    {
        return EBTNodeResult::Failed;
    }

    Target->ApplyServerDamage(AttackDamage);
    return EBTNodeResult::Succeeded;
}
