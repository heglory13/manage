import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { getStatusColor, getStatusLabel, formatDateTime } from '../../lib/utils';

interface StocktakingDetailProps {
  data: {
    id: number;
    code: string;
    warehouseName: string;
    status: string;
    period: string;
    createdAt: string;
    createdBy: { name: string };
    checks: {
      id: number;
      type: string;
      status: string;
      checkedPositions: number;
      totalPositions: number;
    }[];
    results: {
      positionCode: string;
      productName: string;
      expected: number;
      actual: number;
      difference: number;
    }[];
  };
  onSubmit: () => void;
  onApprove?: () => void;
  onReject?: () => void;
}

export default function StocktakingDetail({ data, onSubmit, onApprove, onReject }: StocktakingDetailProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Phiếu kiểm kho: {data.code}</CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Kho: {data.warehouseName} | Kỳ: {data.period}
              </p>
            </div>
            <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${getStatusColor(data.status)}`}>
              {getStatusLabel(data.status)}
            </span>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-sm text-muted-foreground">Người tạo</p>
              <p className="font-medium">{data.createdBy.name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ngày tạo</p>
              <p className="font-medium">{formatDateTime(data.createdAt)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Tiến độ</p>
              <p className="font-medium">
                {data.checks.reduce((sum, c) => sum + c.checkedPositions, 0)} / {data.checks.reduce((sum, c) => sum + c.totalPositions, 0)} vị trí
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="checks">
        <TabsList>
          <TabsTrigger value="checks">Phiếu kiểm tra</TabsTrigger>
          <TabsTrigger value="results">Kết quả</TabsTrigger>
        </TabsList>

        <TabsContent value="checks">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Loại</TableHead>
                    <TableHead>Trạng thái</TableHead>
                    <TableHead className="text-right">Đã kiểm</TableHead>
                    <TableHead className="text-right">Tổng vị trí</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.checks.map(check => (
                    <TableRow key={check.id}>
                      <TableCell>{check.type === 'PRELIMINARY' ? 'Sơ bộ' : 'Chi tiết'}</TableCell>
                      <TableCell>
                        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(check.status)}`}>
                          {getStatusLabel(check.status)}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{check.checkedPositions}</TableCell>
                      <TableCell className="text-right">{check.totalPositions}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="results">
          <Card>
            <CardContent className="pt-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vị trí</TableHead>
                    <TableHead>Sản phẩm</TableHead>
                    <TableHead className="text-right">Dự kiến</TableHead>
                    <TableHead className="text-right">Thực tế</TableHead>
                    <TableHead className="text-right">Chênh lệch</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.results.map((result, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-medium">{result.positionCode}</TableCell>
                      <TableCell>{result.productName}</TableCell>
                      <TableCell className="text-right">{result.expected}</TableCell>
                      <TableCell className="text-right">{result.actual}</TableCell>
                      <TableCell className={`text-right font-medium ${result.difference < 0 ? 'text-red-600' : result.difference > 0 ? 'text-green-600' : ''}`}>
                        {result.difference > 0 ? '+' : ''}{result.difference}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {data.status === 'SUBMITTED' && (
        <div className="flex justify-end gap-2">
          <Button variant="destructive" onClick={onReject}>
            Từ chối
          </Button>
          <Button onClick={onApprove}>
            Phê duyệt
          </Button>
        </div>
      )}

      {data.status === 'DRAFT' && (
        <div className="flex justify-end">
          <Button onClick={onSubmit}>
            Gửi phiếu kiểm kho
          </Button>
        </div>
      )}
    </div>
  );
}
