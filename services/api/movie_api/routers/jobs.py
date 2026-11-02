from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from movie_schema import Job, JobCreate, JobStatus

from ..db import JobRow, get_session, list_rows
from ..ids import new_id
from ..queue import enqueue

router = APIRouter(prefix="/jobs", tags=["jobs"])


@router.get("", response_model=list[Job])
def list_jobs(status: JobStatus | None = None, limit: int = Query(50, le=500),
              session: Session = Depends(get_session)) -> list[Job]:
    filters = [JobRow.status == status.value] if status else []
    rows = list_rows(session, JobRow, *filters, limit=limit, order_by=JobRow.created_at.desc())
    return [r.to_model() for r in rows]


@router.post("", response_model=Job, status_code=202)
def create_job(body: JobCreate, session: Session = Depends(get_session)) -> Job:
    job = Job(id=new_id("job"), kind=body.kind, params=body.params)
    session.add(JobRow.from_model(job))
    session.commit()
    enqueue(job.id)
    # inline バックエンドでは既に完了しているので最新状態を返す
    row = session.get(JobRow, job.id)
    session.refresh(row)
    return row.to_model()


@router.get("/{job_id}", response_model=Job)
def get_job(job_id: str, session: Session = Depends(get_session)) -> Job:
    row = session.get(JobRow, job_id)
    if not row:
        raise HTTPException(404, "job not found")
    return row.to_model()


@router.post("/{job_id}/cancel", response_model=Job)
def cancel_job(job_id: str, session: Session = Depends(get_session)) -> Job:
    row = session.get(JobRow, job_id)
    if not row:
        raise HTTPException(404, "job not found")
    job = row.to_model()
    if job.status in (JobStatus.succeeded, JobStatus.failed, JobStatus.canceled):
        return job
    # TODO: running 中のジョブはワーカー側にキャンセル要求を送る(Redis フラグ)。MVP では queued のみ即時反映
    job.status = JobStatus.canceled
    row.update_from_model(job)
    session.commit()
    return job
