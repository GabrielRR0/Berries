from pydantic import BaseModel

from app.modules.analytics.contracts.resources.category_monthly_trend_item_resource import CategoryMonthlyTrendItemResource


class CategoryMonthlyTrendResource(BaseModel):
    months: list[str]
    # Las categorías con mayor total ACUMULADO en toda la ventana, de mayor a menor,
    # más una última entrada "Otros" (solo si sobran categorías) con el resto sumado -
    # ver get_category_monthly_trend().
    categories: list[CategoryMonthlyTrendItemResource]
