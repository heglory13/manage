export default function StocktakingPrintView({ data }: { data: any }) {
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="print:p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">PHIẾU KIỂM KHO</h1>
          <p className="text-muted-foreground">Mã: {data.code}</p>
        </div>
        <button
          onClick={handlePrint}
          className="rounded-md bg-primary px-4 py-2 text-primary-foreground print:hidden"
        >
          In phiếu
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Kho</p>
          <p className="font-medium">{data.warehouseName}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Kỳ kiểm kho</p>
          <p className="font-medium">{data.period}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Ngày tạo</p>
          <p className="font-medium">{new Date(data.createdAt).toLocaleDateString('vi-VN')}</p>
        </div>
        <div>
          <p className="text-sm text-muted-foreground">Người tạo</p>
          <p className="font-medium">{data.createdBy?.name}</p>
        </div>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border bg-muted">
            <th className="border p-2 text-left">Vị trí</th>
            <th className="border p-2 text-left">Sản phẩm</th>
            <th className="border p-2 text-right">Dự kiến</th>
            <th className="border p-2 text-right">Thực tế</th>
            <th className="border p-2 text-right">Chênh lệch</th>
          </tr>
        </thead>
        <tbody>
          {data.results?.map((result: any, idx: number) => (
            <tr key={idx} className="border">
              <td className="border p-2">{result.positionCode}</td>
              <td className="border p-2">{result.productName}</td>
              <td className="border p-2 text-right">{result.expected}</td>
              <td className="border p-2 text-right">{result.actual}</td>
              <td className="border p-2 text-right">{result.difference}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-8 grid grid-cols-3 gap-4">
        <div className="text-center">
          <p className="mb-16">Người lập phiếu</p>
          <p className="text-sm text-muted-foreground">(Ký và ghi rõ họ tên)</p>
        </div>
        <div className="text-center">
          <p className="mb-16">Người kiểm tra</p>
          <p className="text-sm text-muted-foreground">(Ký và ghi rõ họ tên)</p>
        </div>
        <div className="text-center">
          <p className="mb-16">Thủ kho</p>
          <p className="text-sm text-muted-foreground">(Ký và ghi rõ họ tên)</p>
        </div>
      </div>
    </div>
  );
}
