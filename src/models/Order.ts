export class Order {

    private status: number;

    constructor(
        public readonly id: number,
        public readonly cpf: string,
        private address: string,
        private products: any[]
    ) {
        this.status = 0;
    }

    getStatus() {
        return this.status;
    }

    setStatus(status: number) {
        this.status = status;
    }

}