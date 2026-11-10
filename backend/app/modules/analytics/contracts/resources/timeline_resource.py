from pydantic import BaseModel

from app.modules.analytics.contracts.enums import Granularity
from app.modules.analytics.contracts.resources.timeline_bucket_resource import TimelineBucketResource


class TimelineResource(BaseModel):
    granularity: Granularity
    # Un elemento por período del rango, de más antiguo a más reciente, con ceros en los vacíos.
    buckets: list[TimelineBucketResource]
